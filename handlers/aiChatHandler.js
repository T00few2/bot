const OpenAI = require("openai");
const config = require("../config/config");
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
 * OpenAI Function Definitions - Maps to your existing slash commands
 */
const functionDefinitions = [
  {
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
  },
  {
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
  },
  {
    name: "whoami",
    description: "Get the Zwift ID linked to the user who is asking",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
    return message.mentions.users.get(userId) || message.guild.members.cache.get(userId)?.user;
  }
  
  // Search by username (case-insensitive)
  const username = userString.replace('@', '').toLowerCase();
  const member = message.guild.members.cache.find(m => 
    m.user.username.toLowerCase() === username || 
    m.user.tag.toLowerCase() === username ||
    m.displayName.toLowerCase() === username
  );
  
  return member?.user || null;
}

/**
 * Execute a command based on OpenAI function call
 */
async function executeCommand(functionCall, message) {
  const { name, arguments: argsString } = functionCall;
  let args;
  
  try {
    args = JSON.parse(argsString);
  } catch (error) {
    console.error("Error parsing function arguments:", error);
    await message.reply("⚠️ I had trouble understanding the command parameters. Please try rephrasing.");
    return { success: false, message: "Invalid function arguments" };
  }
  
  console.log(`🤖 Executing command: ${name}`, args);
  
  try {
    switch (name) {
      case "rider_stats": {
        const options = {
          strings: {},
          users: {}
        };
        
        if (args.zwiftid) {
          options.strings.zwiftid = args.zwiftid;
        }
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return { success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        const result = await handleRiderStats(interaction);
        return result ?? { success: true };
      }
      
      case "team_stats": {
        const options = {
          users: {}
        };
        
        if (!args.riders || !Array.isArray(args.riders)) {
          await message.reply("❌ Please specify 2-8 riders to compare.");
          return { success: false, message: "Invalid riders array" };
        }
        
        // Resolve all rider usernames to User objects
        for (let i = 0; i < Math.min(args.riders.length, 8); i++) {
          const user = resolveUser(args.riders[i], message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.riders[i]}`);
            return { success: false, message: `Discord user ${args.riders[i]} not found` };
          }
          options.users[`rider${i + 1}`] = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        const result = await handleTeamStats(interaction);
        return result ?? { success: true };
      }
      
      case "whoami": {
        const interaction = createSyntheticInteraction(message);
        await handleWhoAmI(interaction);
        return { success: true };
      }
      
      case "get_zwiftid": {
        const options = {
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return { success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleGetZwiftId(interaction);
        return { success: true };
      }
      
      case "browse_riders": {
        const options = {
          strings: {
            searchterm: args.searchterm
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleBrowseRiders(interaction);
        return { success: true };
      }
      
      case "event_results": {
        const options = {
          strings: {
            search: args.search
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleEventResults(interaction);
        return { success: true };
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
        return { success: true };
      }
      
      case "set_zwiftid": {
        // Check permissions
        if (!message.member.permissions.has('ManageMessages')) {
          await message.reply("❌ You need 'Manage Messages' permission to set Zwift IDs for other users.");
          return { success: false, message: "Missing Manage Messages permission" };
        }
        
        const options = {
          strings: {},
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return { success: false, message: `Discord user ${args.discord_username} not found` };
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
        return { success: true };
      }
      
      default:
        await message.reply(`❌ Unknown command: ${name}`);
        return { success: false, message: `Unknown command: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing command ${name}:`, error);
    await message.reply("⚠️ An error occurred while executing the command. Please try again.");
    return { success: false, message: "Unhandled error executing command", error: error?.message };
  }
}

/**
 * Clear conversation for a user
 */
function clearConversation(userId) {
  userConversations.delete(userId);
  const timer = conversationTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(userId);
  }
  console.log(`🧹 Cleared conversation for user ${userId}`);
}

/**
 * Reset conversation timeout for a user
 */
function resetConversationTimeout(userId) {
  // Clear existing timer
  const existingTimer = conversationTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    clearConversation(userId);
  }, CONVERSATION_TIMEOUT);
  
  conversationTimers.set(userId, timer);
}

/**
 * Main handler for AI chat messages
 */
async function handleAIChatMessage(message, client) {
  // Check if OpenAI is configured
  if (!openai) {
    await message.reply("⚠️ AI chat is not configured. Please contact an administrator.");
    return;
  }
  
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Only respond when the bot is directly mentioned (exclude @everyone/@here)
  if (!message.mentions.users.has(client.user.id)) return;
  
  try {
    // Show typing indicator
    await message.channel.sendTyping();
    
    // Clean the message (remove only the bot mention, preserve user mentions)
    const botMentionPattern = new RegExp(`<@!?${client.user.id}>`, 'g');
    const cleanedMessage = message.content
      .replace(botMentionPattern, '') // Remove only bot mention
      .trim();
    
    if (!cleanedMessage) {
      await message.reply("👋 Hello! I can help you with rider stats, team comparisons, and more. Just ask me something like:\n• Show me stats for @Chris\n• Compare @John, @Mike, and @Sarah\n• What's my Zwift ID?");
      return;
    }
    
    const userId = message.author.id;
    
    // Get or create conversation history
    let conversation = userConversations.get(userId);
    
    if (!conversation) {
      // Initialize new conversation
      conversation = [
        {
          role: "system",
          content: `You are a helpful Discord bot assistant for a cycling club. You help users with:
- Fetching rider statistics from Zwift/ZwiftPower
- Comparing multiple riders' performance
- Looking up and linking Zwift IDs to Discord accounts
- Searching for riders and events

When users mention Discord users with @ (like @Chris), preserve the mention format in your function calls.
Be friendly, concise, and helpful. If you need to call a function, do so. If you can't help with something, politely explain why.

Current user: ${message.author.username} (ID: ${message.author.id})`
        }
      ];
    }
    
    // Add user message to conversation
    conversation.push({
      role: "user",
      content: cleanedMessage
    });
    
    // Trim conversation if too long
    if (conversation.length > MAX_CONVERSATION_LENGTH) {
      conversation = [
        conversation[0], // Keep system message
        ...conversation.slice(-MAX_CONVERSATION_LENGTH)
      ];
    }
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap model
      messages: conversation,
      functions: functionDefinitions,
      function_call: "auto",
      temperature: 0.7,
      max_tokens: 500
    });
    
    const { message: responseMessage } = response.choices[0];
    
    // Check if ChatGPT wants to call a function
    if (responseMessage.function_call) {
      // Add assistant's function call to conversation
      conversation.push({
        role: "assistant",
        content: responseMessage.content || "",
        function_call: responseMessage.function_call
      });

      // Execute the command and capture result
      const commandResult = await executeCommand(responseMessage.function_call, message);
      const functionPayload = commandResult ?? { success: true };

      // Pass command result back into the conversation for model awareness
      conversation.push({
        role: "function",
        name: responseMessage.function_call.name,
        content: JSON.stringify(functionPayload)
      });

      // Optionally get a follow-up response using the function output
      const fnName = responseMessage.function_call.name;
      const shouldGenerateFollowUp = functionPayload?.success && (fnName === "rider_stats" || fnName === "team_stats");

      if (shouldGenerateFollowUp) {
        if (conversation.length > MAX_CONVERSATION_LENGTH) {
          conversation = [
            conversation[0],
            ...conversation.slice(-MAX_CONVERSATION_LENGTH)
          ];
        }

        try {
          const prompt = fnName === "team_stats"
            ? "Give a playful 1-3 sentence commentary comparing these riders. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists."
            : "Give a playful 1-3 sentence commentary about the rider. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists.";

          const followUpMessages = [
            ...conversation,
            { role: "user", content: prompt }
          ];

          const followUp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: followUpMessages,
            temperature: 1.0,
            max_tokens: 300
          });

          const followUpMessage = followUp.choices[0]?.message;

          if (followUpMessage?.content && followUpMessage.content.trim().length > 0) {
            conversation.push({
              role: "assistant",
              content: followUpMessage.content
            });

            await message.reply(followUpMessage.content);
          } else if (fnName === "rider_stats" && functionPayload?.rider) {
            const fallback = buildRiderComment(functionPayload.rider);
            if (fallback) {
              conversation.push({ role: "assistant", content: fallback });
              await message.reply(fallback);
            }
          } else if (fnName === "team_stats" && Array.isArray(functionPayload?.team)) {
            const fallback = buildTeamComment(functionPayload.team);
            if (fallback) {
              conversation.push({ role: "assistant", content: fallback });
              await message.reply(fallback);
            }
          }
        } catch (followUpError) {
          console.error("Error generating follow-up AI response:", followUpError);
          // Fallback to a minimal heuristic-based commentary
          if (fnName === "rider_stats" && functionPayload?.rider) {
            const fallback = buildRiderComment(functionPayload.rider);
            if (fallback) {
              conversation.push({ role: "assistant", content: fallback });
              await message.reply(fallback);
            }
          } else if (fnName === "team_stats" && Array.isArray(functionPayload?.team)) {
            const fallback = buildTeamComment(functionPayload.team);
            if (fallback) {
              conversation.push({ role: "assistant", content: fallback });
              await message.reply(fallback);
            }
          }
        }
      }
    } else {
      // ChatGPT responded conversationally (no function call)
      conversation.push({
        role: "assistant",
        content: responseMessage.content
      });
      
      await message.reply(responseMessage.content);
    }
    
    // Trim conversation if it has grown too long after processing
    if (conversation.length > MAX_CONVERSATION_LENGTH) {
      conversation = [
        conversation[0],
        ...conversation.slice(-MAX_CONVERSATION_LENGTH)
      ];
    }

    // Save updated conversation
    userConversations.set(userId, conversation);
    
    // Reset timeout
    resetConversationTimeout(userId);
    
  } catch (error) {
    console.error("Error in AI chat handler:", error);
    
    if (error.code === 'insufficient_quota') {
      await message.reply("⚠️ OpenAI API quota exceeded. Please contact an administrator.");
    } else if (error.code === 'invalid_api_key') {
      await message.reply("⚠️ OpenAI API key is invalid. Please contact an administrator.");
    } else {
      await message.reply("⚠️ An error occurred while processing your message. Please try again.");
    }
  }
}

module.exports = {
  handleAIChatMessage,
  clearConversation // Export for testing/admin commands
};

