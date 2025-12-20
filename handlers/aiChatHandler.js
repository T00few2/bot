const OpenAI = require("openai");
const { ChannelType } = require("discord.js");
const config = require("../config/config");
const { getAllBotKnowledge, getUserZwiftId, getDZRTeamsAndSeries } = require("../services/firebase");
const { 
  handleRiderStats, 
  handleTeamStats, 
  handleWhoAmI, 
  handleGetZwiftId, 
  handleBrowseRiders, 
  handleEventResults,
  handleMyZwiftId,
  handleSetZwiftId
} = require("./commandHandlers");

// Initialize OpenAI client
let openai;
try {
  if (config.openai?.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
} catch (error) {
  console.warn("⚠️ OpenAI not configured. AI chat features will be disabled.");
}

// Store conversations per user
const userConversations = new Map();
const conversationTimers = new Map();

// Configuration
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_CONVERSATION_LENGTH = 20; // Last 20 messages (10 exchanges)

// AI Model Configuration - can be changed to test different models
const AI_CONFIG = {
  model: "gpt-4.1-mini",  // Options: "gpt-4o-mini", "gpt-4.1-mini", "gpt-4o", "gpt-4.1"
  temperature: 0.3,       // Lower = more deterministic function selection
  maxTokens: 800,         // Increased for better responses
  maxRetries: 2,          // Retry attempts for rate limits
  retryDelayMs: 2000,     // Base delay between retries
};

// Tool-calling safety
const MAX_TOOL_ITERATIONS = 2;

// These tools already produce user-visible Discord messages via existing handlers.
// If we also ask the LLM to "respond with results" afterwards, it often becomes duplicate/noisy.
const TOOLS_THAT_REPLY_DIRECTLY = new Set([
  "rider_stats",
  "team_stats",
  "whoami",
  "get_zwiftid",
  "browse_riders",
  "event_results",
  "my_zwiftid",
  "set_zwiftid",
]);

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ success: false, message: "Failed to serialize tool result." });
  }
}

/**
 * Compact tool results before adding them to the model context.
 * Big payloads (e.g. teams arrays) quickly degrade model performance & cost.
 */
function compactToolResult(result) {
  if (!result || typeof result !== "object") return result;

  const base = {
    tool_call_id: result.tool_call_id,
    success: !!result.success,
  };

  if (typeof result.message === "string" && result.message.length > 0) {
    base.message = result.message.slice(0, 500);
  }

  // Common payloads
  if (result.rider) {
    base.rider = result.rider;
  }
  if (result.team) {
    base.team = Array.isArray(result.team) ? result.team.slice(0, 8) : result.team;
    if (Array.isArray(result.team) && result.team.length > 8) base.team_truncated = true;
  }
  if (result.teams) {
    base.teams = Array.isArray(result.teams) ? result.teams.slice(0, 25) : result.teams;
    if (Array.isArray(result.teams) && result.teams.length > 25) base.teams_truncated = true;
  }
  if (typeof result.title === "string" || typeof result.content === "string") {
    base.title = typeof result.title === "string" ? result.title.slice(0, 200) : undefined;
    base.content = typeof result.content === "string" ? result.content.slice(0, 2000) : undefined;
    base.tags = Array.isArray(result.tags) ? result.tags.slice(0, 25) : undefined;
  }
  if (result.metadata) base.metadata = result.metadata;
  if (result.series) base.series = result.series;
  if (typeof result.error === "string") base.error = result.error.slice(0, 300);

  // Fallback: keep only small scalar keys
  const keepScalars = {};
  for (const [k, v] of Object.entries(result)) {
    if (k in base) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length <= 200) keepScalars[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") keepScalars[k] = v;
  }
  if (Object.keys(keepScalars).length > 0) base.extra = keepScalars;

  return base;
}

function getConversationKey(message) {
  const userId = message?.author?.id || "unknown_user";
  const channelId = message?.channelId || message?.channel?.id || "unknown_channel";
  const guildId = message?.guild?.id || message?.guildId || "dm";
  return `${guildId}:${channelId}:${userId}`;
}

async function isReplyToBot(message, client) {
  const refId = message?.reference?.messageId;
  if (!refId) return false;

  try {
    const cached = message.channel?.messages?.cache?.get(refId);
    if (cached) return cached.author?.id === client.user.id;

    // Fallback: fetch referenced message (may fail if missing perms / deleted)
    const fetched = await message.channel.messages.fetch(refId).catch(() => null);
    if (!fetched) return false;
    return fetched.author?.id === client.user.id;
  } catch {
    return false;
  }
}

/**
 * Build a short, human-friendly rider commentary from summarized stats
 */
function buildRiderComment(rider) {
  if (!rider || typeof rider !== 'object') return null;

  const name = rider.name || 'This rider';
  const ftpWkg = rider?.ftp?.wkg;
  const w5 = rider?.power?.w300?.wkg;   // 5m
  const w20 = rider?.power?.w1200?.wkg; // 20m
  const phenotype = rider?.phenotype || rider?.phenotype?.value;
  const veloCat = rider?.velo?.category;

  const parts = [];

  if (ftpWkg && ftpWkg > 4.0) {
    parts.push(`${name} is packing a serious diesel engine`);
  } else if (ftpWkg && ftpWkg > 3.2) {
    parts.push(`${name} shows solid endurance legs`);
  }

  if (w5 && (!w20 || w5 - w20 > 0.5)) {
    parts.push('short‑burst power pops');
  } else if (w20 && (!w5 || w20 - w5 > 0.2)) {
    parts.push('all‑day power stands out');
  }

  if (phenotype) {
    parts.push(`phenotype: ${phenotype}`);
  }

  if (veloCat) {
    parts.push(`vELO category: ${veloCat}`);
  }

  if (parts.length === 0) {
    return `${name} looks balanced with both snap and staying power.`;
  }

  return parts.join(' • ') + '.';
}

/**
 * Build a short, human-friendly team commentary from summarized team stats
 */
function buildTeamComment(team) {
  if (!Array.isArray(team) || team.length === 0) return null;

  const by = (selector) => team
    .map(r => ({ r, val: selector(r) }))
    .filter(x => typeof x.val === 'number' && Number.isFinite(x.val));

  const ftp = by(r => r?.ftp?.wkg).sort((a,b) => b.val - a.val);
  const w5 = by(r => r?.power?.w300?.wkg).sort((a,b) => b.val - a.val);
  const w20 = by(r => r?.power?.w1200?.wkg).sort((a,b) => b.val - a.val);

  const parts = [];
  if (ftp.length > 0) {
    const top = ftp[0];
    parts.push(`${top.r.name} is the diesel up the climbs`);
  }
  if (w5.length > 0) {
    const top = w5[0];
    parts.push(`${top.r.name} brings the mid‑range punch`);
  }
  if (w20.length > 0) {
    const top = w20[0];
    parts.push(`${top.r.name} holds the line on long efforts`);
  }

  if (parts.length === 0) {
    return `This lineup looks balanced across short and sustained power.`;
  }
  return parts.slice(0, 2).join(' • ') + '.';
}

/**
 * OpenAI Tool Definitions - Using modern tools API format
 */
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_help_article",
      description: "Fetch a short help/knowledge article configured by the admin (for onboarding, ZwiftID help, links, etc.).",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Short topic or keyword describing what help is needed (e.g. 'zwiftid', 'membership', 'notifications')."
          }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dzr_teams",
      description: "Get structured information about Danish Zwift Racers (DZR) teams and race series derived from backend-managed role panels.",
      parameters: {
        type: "object",
        properties: {
          series: {
            type: "string",
            description: "Optional race series filter, e.g. 'WTRL ZRL', 'WTRL TTT', 'DRS', 'Club Ladder'."
          },
          division: {
            type: "string",
            description: "Optional division filter, e.g. 'A1', 'B2', 'Doppio', 'Diamond'."
          },
          looking_for_riders: {
            type: "boolean",
            description: "If true, only return teams that are actively looking for riders."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rider_stats",
      description: "Fetch stats for a single rider by their Zwift ID or Discord user mention",
      parameters: {
        type: "object",
        properties: {
          zwiftid: {
            type: "string",
            description: "The Zwift ID of the rider (numeric string)"
          },
          discord_username: {
            type: "string",
            description: "The Discord username or mention (e.g., '@Chris' or 'Chris')"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "team_stats",
      description: "Compare stats for multiple riders (2-8 riders). Provide Discord usernames or mentions.",
      parameters: {
        type: "object",
        properties: {
          riders: {
            type: "array",
            items: { type: "string" },
            description: "Array of Discord usernames or mentions to compare (e.g., ['@Chris', '@John', '@Mike'])",
            minItems: 2,
            maxItems: 8
          }
        },
        required: ["riders"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "whoami",
      description: "Get the Zwift ID linked to the user who is asking",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_zwiftid",
      description: "Get the linked Zwift ID for a specific Discord user",
      parameters: {
        type: "object",
        properties: {
          discord_username: {
            type: "string",
            description: "The Discord username or mention"
          }
        },
        required: ["discord_username"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browse_riders",
      description: "Search for riders by name (first 3+ letters)",
      parameters: {
        type: "object",
        properties: {
          searchterm: {
            type: "string",
            description: "First 3 or more letters of the rider's name"
          }
        },
        required: ["searchterm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "event_results",
      description: "Get team results from events matching a search string",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Search string to match in event titles"
          }
        },
        required: ["search"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "my_zwiftid",
      description: "Link the user's Discord account to their Zwift ID. Can provide direct Zwift ID or search term.",
      parameters: {
        type: "object",
        properties: {
          zwiftid: {
            type: "string",
            description: "Direct Zwift ID to link (numeric string)"
          },
          searchterm: {
            type: "string",
            description: "First 3+ letters of name to search for in club stats"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_zwiftid",
      description: "Link a Discord user's account to a Zwift ID (admin/moderator function). Requires manage messages permission.",
      parameters: {
        type: "object",
        properties: {
          discord_username: {
            type: "string",
            description: "The Discord username or mention of the user to link"
          },
          zwiftid: {
            type: "string",
            description: "Direct Zwift ID to link"
          },
          searchterm: {
            type: "string",
            description: "First 3+ letters to search for the rider"
          }
        },
        required: ["discord_username"]
      }
    }
  }
];

/**
 * Create a synthetic interaction object to call existing command handlers
 */
function createSyntheticInteraction(message, options = {}) {
  let replyMessage = null; // Store the initial reply message
  
  const synthetic = {
    // Basic properties
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    channelId: message.channelId,
    
    // State flags
    replied: false,
    deferred: false,
    isAIChatInteraction: true, // Flag to indicate this is from AI chat, not slash command
    
    // Options getter
    options: {
      getString: (name) => options.strings?.[name] || null,
      getUser: (name) => options.users?.[name] || null,
      getInteger: (name) => options.integers?.[name] || null,
    },
    
    // Reply methods
    reply: async (content) => {
      synthetic.replied = true;
      // Handle different content types (string, object with embeds, etc.)
      if (typeof content === 'string') {
        replyMessage = await message.reply(content);
      } else {
        // For AI chat, skip ephemeral and send directly to channel
        // Remove "publish" button if present
        const cleanContent = { ...content };
        if (cleanContent.components) {
          cleanContent.components = [];
        }
        replyMessage = await message.reply(cleanContent);
      }
      return replyMessage;
    },
    
    editReply: async (content) => {
      // If we already have a reply message, edit it
      if (replyMessage) {
        // For AI chat, skip ephemeral and send directly
        const cleanContent = typeof content === 'string' ? content : { ...content };
        if (typeof cleanContent === 'object' && cleanContent.components) {
          cleanContent.components = [];
        }
        return await replyMessage.edit(cleanContent);
      }
      // Otherwise, create the initial reply
      synthetic.replied = true;
      if (typeof content === 'string') {
        replyMessage = await message.reply(content);
      } else {
        const cleanContent = { ...content };
        if (cleanContent.components) {
          cleanContent.components = [];
        }
        replyMessage = await message.reply(cleanContent);
      }
      return replyMessage;
    },
    
    followUp: async (content) => {
      // Remove publish buttons from follow-ups too
      const cleanContent = typeof content === 'string' ? content : { ...content };
      if (typeof cleanContent === 'object' && cleanContent.components) {
        cleanContent.components = [];
      }
      return await message.channel.send(cleanContent);
    },
    
    // For publish button functionality
    get message() {
      return replyMessage;
    }
  };
  
  return synthetic;
}

/**
 * Resolve Discord username/mention to User object
 */
function resolveUser(userString, message) {
  if (!userString) return null;
  
  // Extract user ID from mention format <@123456789>
  const mentionMatch = userString.match(/<@!?(\d+)>/);
  if (mentionMatch) {
    const userId = mentionMatch[1];
    // Try mentions, then global user cache (DMs may not have a guild)
    const mentioned = message.mentions.users.get(userId);
    if (mentioned) return mentioned;
    if (message.client && message.client.users) {
      return message.client.users.cache.get(userId) || null;
    }
    return null;
  }
  
  // Search by username (case-insensitive)
  const username = userString.replace('@', '').toLowerCase();

  // If we're in a DM, we don't have a guild member list – fall back to the author
  if (!message.guild) {
    const author = message.author;
    if (!author) return null;
    const tag = (author.tag || "").toLowerCase();
    if (
      author.username.toLowerCase() === username ||
      tag === username
    ) {
      return author;
    }
    return null;
  }

  // In guilds, search member cache
  const member = message.guild.members.cache.find(m => 
    m.user.username.toLowerCase() === username || 
    m.user.tag.toLowerCase() === username ||
    m.displayName.toLowerCase() === username
  );
  
  return member?.user || null;
}

/**
 * Execute a single tool call
 */
async function executeSingleToolCall(toolCall, message) {
  const { name, arguments: argsString } = toolCall.function;
  let args;
  
  try {
    args = JSON.parse(argsString);
  } catch (error) {
    console.error("Error parsing function arguments:", error);
    return { 
      tool_call_id: toolCall.id,
      success: false, 
      message: "Invalid function arguments" 
    };
  }
  
  console.log(`🤖 Executing tool: ${name}`, {
    user: message.author.tag,
    guild: message.guild?.name || 'DM',
    args
  });
  
  try {
    let result;
    
    switch (name) {
      case "rider_stats": {
        const options = {
          strings: {},
          users: {}
        };

        // If no explicit ZwiftID or Discord user was provided, assume user means "my stats"
        if (!args.zwiftid && !args.discord_username) {
          const selfZwiftId = await getUserZwiftId(message.author.id);
          if (!selfZwiftId) {
            const msg =
              "❌ I couldn't find a linked ZwiftID for you.\n\n" +
              "I can link it for you — just reply to this message (or mention me again) with either:\n" +
              "• your ZwiftID (numbers only), or\n" +
              "• the first 3+ letters of your Zwift name.\n\n" +
              "Then I’ll link it and fetch your stats.";
            await message.reply(msg);
            return { tool_call_id: toolCall.id, success: false, message: msg };
          }
          options.strings.zwiftid = String(selfZwiftId);
        } else {
          if (args.zwiftid) {
            options.strings.zwiftid = args.zwiftid;
          }

          if (args.discord_username) {
            const user = resolveUser(args.discord_username, message);
            if (!user) {
              await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
              return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
            }
            options.users.discorduser = user;
          }
        }

        const interaction = createSyntheticInteraction(message, options);
        result = await handleRiderStats(interaction);
        return { tool_call_id: toolCall.id, ...(result ?? { success: true }) };
      }
      
      case "team_stats": {
        const options = {
          users: {}
        };
        
        if (!args.riders || !Array.isArray(args.riders)) {
          await message.reply("❌ Please specify 2-8 riders to compare.");
          return { tool_call_id: toolCall.id, success: false, message: "Invalid riders array" };
        }
        
        // Resolve all rider usernames to User objects
        for (let i = 0; i < Math.min(args.riders.length, 8); i++) {
          const user = resolveUser(args.riders[i], message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.riders[i]}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.riders[i]} not found` };
          }
          options.users[`rider${i + 1}`] = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        result = await handleTeamStats(interaction);
        return { tool_call_id: toolCall.id, ...(result ?? { success: true }) };
      }
      
      case "whoami": {
        const interaction = createSyntheticInteraction(message);
        await handleWhoAmI(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "get_zwiftid": {
        const options = {
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleGetZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "browse_riders": {
        const options = {
          strings: {
            searchterm: args.searchterm
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleBrowseRiders(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "event_results": {
        const options = {
          strings: {
            search: args.search
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleEventResults(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "my_zwiftid": {
        const options = {
          strings: {}
        };
        
        if (args.zwiftid) {
          options.strings.zwiftid = args.zwiftid;
        }
        
        if (args.searchterm) {
          options.strings.searchterm = args.searchterm;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleMyZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "set_zwiftid": {
        // Check permissions
        if (!message.member?.permissions.has('ManageMessages')) {
          await message.reply("❌ You need 'Manage Messages' permission to set Zwift IDs for other users.");
          return { tool_call_id: toolCall.id, success: false, message: "Missing Manage Messages permission" };
        }
        
        const options = {
          strings: {},
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        if (args.zwiftid) {
          options.strings.zwiftid = args.zwiftid;
        }
        
        if (args.searchterm) {
          options.strings.searchterm = args.searchterm;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleSetZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }

      case "get_help_article": {
        const topic = (args.topic || "").toString().toLowerCase();
        const all = await getAllBotKnowledge();
        if (!all || all.length === 0) {
          return { tool_call_id: toolCall.id, success: false, message: "No bot knowledge entries configured." };
        }

        // Very simple matching: check key, title and tags for substring
        const scored = all.map(entry => {
          const key = (entry.key || entry.id || "").toString().toLowerCase();
          const title = (entry.title || "").toLowerCase();
          const tags = Array.isArray(entry.tags) ? entry.tags.map(t => String(t).toLowerCase()) : [];
          let score = 0;
          if (key.includes(topic)) score += 3;
          if (title.includes(topic)) score += 2;
          if (tags.some(t => t.includes(topic))) score += 2;
          return { entry, score };
        }).filter(x => x.score > 0);

        if (scored.length === 0) {
          return { tool_call_id: toolCall.id, success: false, message: `No knowledge entry matched topic '${topic}'.` };
        }

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0].entry;

        // Return a compact payload for the model to use
        return {
          tool_call_id: toolCall.id,
          success: true,
          key: best.key || best.id,
          title: best.title || "",
          content: best.content || "",
          tags: best.tags || []
        };
      }

      case "get_dzr_teams": {
        const { teams, series } = await getDZRTeamsAndSeries();
        let filteredTeams = teams;

        const normalize = (val) =>
          String(val ?? "")
            .toLowerCase()
            .trim()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");

        if (args.series) {
          const s = normalize(args.series);
          filteredTeams = filteredTeams.filter(
            (t) => normalize(t.raceSeries || "") === s
          );
        }
        if (args.division) {
          const d = normalize(args.division);
          const isSingleLetterDivision = /^[abcd]$/.test(d);
          filteredTeams = filteredTeams.filter((t) => {
            const teamDiv = normalize(t.division || "");
            if (!teamDiv) return false;

            // If user asks for "B", match B1/B2/B Development/etc.
            if (isSingleLetterDivision) {
              return teamDiv.startsWith(d);
            }

            // Otherwise, allow exact match or startsWith (covers "b2" vs "b2 something"),
            // and finally fallback to substring match for flexible phrasing.
            return teamDiv === d || teamDiv.startsWith(d) || teamDiv.includes(d);
          });
        }
        if (typeof args.looking_for_riders === "boolean") {
          if (args.looking_for_riders) {
            filteredTeams = filteredTeams.filter((t) => !!t.lookingForRiders);
          }
        }

        // Return a compact payload
        return {
          tool_call_id: toolCall.id,
          success: true,
          teams: filteredTeams.map((t) => ({
            teamName: t.teamName || t.roleName,
            raceSeries: t.raceSeries,
            division: t.division,
            rideTime: t.rideTime,
            lookingForRiders: !!t.lookingForRiders,
            captainDiscordId: t.teamCaptainId || null,
            captainDisplayName: t.captainDisplayName || null,
          })),
          series: series,
        };
      }
      
      default:
        await message.reply(`❌ Unknown command: ${name}`);
        return { tool_call_id: toolCall.id, success: false, message: `Unknown command: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    await message.reply("⚠️ An error occurred while executing the command. Please try again.");
    return { tool_call_id: toolCall.id, success: false, message: "Unhandled error executing command", error: error?.message };
  }
}

/**
 * Execute multiple tool calls (supports parallel execution)
 */
async function executeToolCalls(toolCalls, message) {
  // Execute all tool calls in parallel
  const results = await Promise.all(
    toolCalls.map(toolCall => executeSingleToolCall(toolCall, message))
  );
  
  return results;
}

/**
 * Clear conversation for a user
 */
function clearConversation(userId) {
  const key = String(userId);

  // If passed a scoped conversation key, just clear that one.
  if (key.includes(":")) {
    clearConversationForKey(key);
    return;
  }

  // Legacy: clear any per-user conversation (old behavior)
  userConversations.delete(key);
  const timer = conversationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(key);
  }

  // New: clear all scoped conversations for this user across guilds/channels
  for (const k of Array.from(userConversations.keys())) {
    if (typeof k === "string" && k.endsWith(`:${key}`)) {
      userConversations.delete(k);
    }
  }
  for (const k of Array.from(conversationTimers.keys())) {
    if (typeof k === "string" && k.endsWith(`:${key}`)) {
      const t = conversationTimers.get(k);
      if (t) clearTimeout(t);
      conversationTimers.delete(k);
    }
  }

  console.log(`🧹 Cleared conversation(s) for user ${key}`);
}

function clearConversationForKey(conversationKey) {
  const key = String(conversationKey);
  userConversations.delete(key);
  const timer = conversationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(key);
  }
  console.log(`🧹 Cleared conversation for key ${key}`);
}

/**
 * Reset conversation timeout for a user
 */
function resetConversationTimeout(userId) {
  const key = String(userId);
  // Clear existing timer
  const existingTimer = conversationTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    clearConversation(key);
  }, CONVERSATION_TIMEOUT);
  
  conversationTimers.set(key, timer);
}

/**
 * Build the system prompt with context
 */
function buildSystemPrompt(message) {
  const serverName = message.guild?.name || 'Direct Message';
  const timestamp = new Date().toISOString();
  
  return `You are a helpful Discord bot assistant for Danish Zwift Racers (DZR), a cycling club focused on virtual racing in Zwift.

## Your Capabilities
You can help users with:
- Fetching rider statistics from Zwift/ZwiftPower (power data, race history, rankings)
- Comparing multiple riders' performance side by side
- Looking up and linking Zwift IDs to Discord accounts
- Searching for riders by name
- Finding event results
- Providing information about DZR teams and race series
- Answering questions using the admin-maintained knowledge base

## Important Rules
1. **ALWAYS use a tool call** when the user wants to take an action (fetch stats, link ID, search, etc.)
2. **Respond conversationally** only for greetings, clarifying questions, or general chat
3. When users mention Discord users with @ (like @Chris), **preserve the mention format** in your tool calls
4. If you're unsure what the user wants, **ask for clarification** rather than guessing
5. Before inventing answers about DZR teams or help topics, **check the knowledge base** or team data first

## Response Style
- Be friendly, helpful, and concise
- Use occasional Danish phrases since this is a Danish cycling club (e.g., "Godt træk!", "Kør stærkt!")
- When providing commentary about riders, be playful and use cycling metaphors
- Avoid overly technical jargon unless the user asks for details

## Current Context
- User: ${message.author.username} (ID: ${message.author.id})
- Server: ${serverName}
- Time: ${timestamp}`;
}

/**
 * Call OpenAI API with retry logic for rate limits
 */
async function callOpenAIWithRetry(params) {
  const { maxRetries, retryDelayMs } = AI_CONFIG;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (error) {
      const isRateLimit = error.code === 'rate_limit_exceeded' || error.status === 429;
      const isLastAttempt = attempt === maxRetries;
      
      if (isRateLimit && !isLastAttempt) {
        const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      throw error;
    }
  }
}

/**
 * Main handler for AI chat messages
 */
async function handleAIChatMessage(message, client) {
  // Check if OpenAI is configured
  if (!openai) {
    return; // Silently ignore if not configured
  }
  
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;

  // In guild channels: only respond when the bot is mentioned.
  // In DMs: treat every message as directed to the bot.
  if (!isDM) {
    const mentioned = message.mentions.users.has(client.user.id);
    const repliedToMe = await isReplyToBot(message, client);
    if (!mentioned && !repliedToMe) return;
  }
  
  try {
    // Show typing indicator
    await message.channel.sendTyping();

    // Clean the message (remove only the bot mention, preserve user mentions)
    const botMentionPattern = new RegExp(`<@!?${client.user.id}>`, 'g');
    const cleanedMessage = message.content
      .replace(botMentionPattern, '') // Remove only bot mention
      .trim();

    if (!cleanedMessage) {
      await message.reply("👋 Hej! I can help you with rider stats, team comparisons, and more. Just ask me something like:\n• Show me stats for @Chris\n• Compare @John, @Mike, and @Sarah\n• What's my Zwift ID?\n• Find riders named Anders");
      return;
    }

    // Shortcut: "mine stats" → use caller's linked ZwiftID directly
    const normalized = cleanedMessage.toLowerCase().replace(/[!?\.]+$/g, '').trim();
    if (normalized === "mine stats" || normalized === "my stats") {
      const zwiftId = await getUserZwiftId(message.author.id);
      if (!zwiftId) {
        await message.reply(
          "❌ Du har endnu ikke linket et ZwiftID.\n\n" +
          "Svar på denne besked med dit ZwiftID (kun tal) eller de første 3+ bogstaver i dit Zwift-navn — så linker jeg det for dig.\n" +
          "(Alternativt: nævn mig igen i kanalen.)"
        );
        return;
      }

      try {
        const interaction = createSyntheticInteraction(message, {
          strings: { zwiftid: String(zwiftId) }
        });
        await handleRiderStats(interaction);
      } catch (err) {
        console.error("Error handling 'mine stats' shortcut:", err);
        await message.reply("⚠️ Der opstod en fejl, da jeg forsøgte at hente dine stats. Prøv igen lidt senere eller brug `/rider_stats` med dit ZwiftID.");
      }
      return;
    }

    const userId = message.author.id;
    const conversationKey = getConversationKey(message);
    
    // Get or create conversation history
    let conversation = userConversations.get(conversationKey);

    if (!conversation) {
      // Initialize new conversation with dynamic system prompt
      conversation = [
        {
          role: "system",
          content: buildSystemPrompt(message)
        }
      ];
    }
    
    // Add user message to conversation
    conversation.push({
      role: "user",
      content: cleanedMessage
    });
    
    // Trim conversation if too long (keep system message)
    if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
      conversation = [
        conversation[0], // Keep system message
        ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
      ];
    }
    
    // Call OpenAI with retry logic
    const response = await callOpenAIWithRetry({
      model: AI_CONFIG.model,
      messages: conversation,
      tools: toolDefinitions,
      tool_choice: "auto",
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens
    });
    
    const responseMessage = response.choices[0].message;
    
    // Check if the model wants to call tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Add assistant's message with tool calls to conversation
      conversation.push({
        role: "assistant",
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls
      });

      // Tool calling loop: execute tools, append results, then let the model produce a user-facing answer.
      // (Bounded to avoid infinite tool loops.)
      let currentToolCalls = responseMessage.tool_calls;
      let toolResults = [];
      let iteration = 0;

      while (currentToolCalls && currentToolCalls.length > 0 && iteration < MAX_TOOL_ITERATIONS) {
        // Execute all tool calls (parallel if multiple)
        toolResults = await executeToolCalls(currentToolCalls, message);

        // Add tool results to conversation (compact to reduce context bloat)
        for (const result of toolResults) {
          conversation.push({
            role: "tool",
            tool_call_id: result.tool_call_id,
            content: safeStringify(compactToolResult(result))
          });
        }

        // If the tools already handled user-visible output, don't force an extra LLM "result summary".
        // Exception: we still do the playful stats commentary below.
        const shouldSkipGenericAnswer = currentToolCalls.every(tc => TOOLS_THAT_REPLY_DIRECTLY.has(tc.function.name));

        // Check if we should generate a follow-up commentary for stats
        const hasStatsCall = currentToolCalls.some(
          tc => tc.function.name === "rider_stats" || tc.function.name === "team_stats"
        );
        const allSuccessful = toolResults.every(r => r.success);

        if (hasStatsCall && allSuccessful) {
          // Trim conversation before follow-up
          if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
            conversation = [
              conversation[0],
              ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
            ];
          }

          try {
            const isTeamStats = currentToolCalls.some(tc => tc.function.name === "team_stats");
            const prompt = isTeamStats
              ? "Give a playful 1-3 sentence commentary comparing these riders. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists."
              : "Give a playful 1-3 sentence commentary about the rider. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists.";

            const followUpMessages = [
              ...conversation,
              { role: "user", content: prompt }
            ];

            const followUp = await callOpenAIWithRetry({
              model: AI_CONFIG.model,
              messages: followUpMessages,
              temperature: 1.0, // Higher creativity for commentary
              max_tokens: 300
            });

            const followUpMessage = followUp.choices[0]?.message;

            if (followUpMessage?.content && followUpMessage.content.trim().length > 0) {
              conversation.push({
                role: "assistant",
                content: followUpMessage.content
              });

              await message.reply(followUpMessage.content);
            } else {
              // Fallback to heuristic commentary
              const statsResult = toolResults.find(r => r.rider || r.team);
              if (statsResult?.rider) {
                const fallback = buildRiderComment(statsResult.rider);
                if (fallback) {
                  conversation.push({ role: "assistant", content: fallback });
                  await message.reply(fallback);
                }
              } else if (statsResult?.team) {
                const fallback = buildTeamComment(statsResult.team);
                if (fallback) {
                  conversation.push({ role: "assistant", content: fallback });
                  await message.reply(fallback);
                }
              }
            }
          } catch (followUpError) {
            console.error("Error generating follow-up AI response:", followUpError);
            // Fallback to heuristic commentary
            const statsResult = toolResults.find(r => r.rider || r.team);
            if (statsResult?.rider) {
              const fallback = buildRiderComment(statsResult.rider);
              if (fallback) {
                conversation.push({ role: "assistant", content: fallback });
                await message.reply(fallback);
              }
            } else if (statsResult?.team) {
              const fallback = buildTeamComment(statsResult.team);
              if (fallback) {
                conversation.push({ role: "assistant", content: fallback });
                await message.reply(fallback);
              }
            }
          }
        }

        // Generic answer step: turn tool results into a natural-language reply when tools didn't already reply.
        if (!shouldSkipGenericAnswer) {
          // Trim before asking again
          if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
            conversation = [
              conversation[0],
              ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
            ];
          }

          const postTool = await callOpenAIWithRetry({
            model: AI_CONFIG.model,
            messages: conversation,
            tools: toolDefinitions,
            tool_choice: "auto",
            temperature: AI_CONFIG.temperature,
            max_tokens: AI_CONFIG.maxTokens
          });

          const postToolMsg = postTool.choices[0]?.message;
          if (!postToolMsg) break;

          // If the model wants to call more tools, continue the loop.
          if (postToolMsg.tool_calls && postToolMsg.tool_calls.length > 0) {
            conversation.push({
              role: "assistant",
              content: postToolMsg.content || null,
              tool_calls: postToolMsg.tool_calls
            });
            currentToolCalls = postToolMsg.tool_calls;
            iteration++;
            continue;
          }

          // Otherwise, send its final content (if any).
          if (postToolMsg.content && postToolMsg.content.trim().length > 0) {
            conversation.push({ role: "assistant", content: postToolMsg.content });
            await message.reply(postToolMsg.content);
          }
        }

        break; // Done with tools for this message
      }
    } else {
      // Model responded conversationally (no tool calls)
      conversation.push({
        role: "assistant",
        content: responseMessage.content
      });
      
      await message.reply(responseMessage.content);
    }
    
    // Trim conversation if it has grown too long after processing
    if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
      conversation = [
        conversation[0],
        ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
      ];
    }

    // Save updated conversation
    userConversations.set(conversationKey, conversation);
    
    // Reset timeout
    resetConversationTimeout(conversationKey);
    
  } catch (error) {
    console.error("Error in AI chat handler:", error);
    
    if (error.code === 'insufficient_quota') {
      await message.reply("⚠️ OpenAI API quota exceeded. Please contact an administrator.");
    } else if (error.code === 'invalid_api_key') {
      await message.reply("⚠️ OpenAI API key is invalid. Please contact an administrator.");
    } else if (error.status === 429) {
      await message.reply("⚠️ Too many requests. Please wait a moment and try again.");
    } else {
      await message.reply("⚠️ An error occurred while processing your message. Please try again.");
    }
  }
}

module.exports = {
  handleAIChatMessage,
  clearConversation, // Export for testing/admin commands
  AI_CONFIG // Export for external configuration if needed
};
