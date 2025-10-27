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
    
    // Options getter
    options: {
      getString: (name) => options.strings?.[name] || null,
      getUser: (name) => options.users?.[name] || null,
      getInteger: (name) => options.integers?.[name] || null,
    },
    
    // Reply methods
    reply: async (content) => {
      synthetic.replied = true;
      replyMessage = await message.reply(content);
      return replyMessage;
    },
    
    editReply: async (content) => {
      // If we already have a reply message, edit it
      if (replyMessage) {
        return await replyMessage.edit(content);
      }
      // Otherwise, create the initial reply
      synthetic.replied = true;
      replyMessage = await message.reply(content);
      return replyMessage;
    },
    
    followUp: async (content) => {
      return await message.channel.send(content);
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
    return;
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
            return;
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleRiderStats(interaction);
        break;
      }
      
      case "team_stats": {
        const options = {
          users: {}
        };
        
        if (!args.riders || !Array.isArray(args.riders)) {
          await message.reply("❌ Please specify 2-8 riders to compare.");
          return;
        }
        
        // Resolve all rider usernames to User objects
        for (let i = 0; i < Math.min(args.riders.length, 8); i++) {
          const user = resolveUser(args.riders[i], message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.riders[i]}`);
            return;
          }
          options.users[`rider${i + 1}`] = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleTeamStats(interaction);
        break;
      }
      
      case "whoami": {
        const interaction = createSyntheticInteraction(message);
        await handleWhoAmI(interaction);
        break;
      }
      
      case "get_zwiftid": {
        const options = {
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return;
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleGetZwiftId(interaction);
        break;
      }
      
      case "browse_riders": {
        const options = {
          strings: {
            searchterm: args.searchterm
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleBrowseRiders(interaction);
        break;
      }
      
      case "event_results": {
        const options = {
          strings: {
            search: args.search
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleEventResults(interaction);
        break;
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
        break;
      }
      
      case "set_zwiftid": {
        // Check permissions
        if (!message.member.permissions.has('ManageMessages')) {
          await message.reply("❌ You need 'Manage Messages' permission to set Zwift IDs for other users.");
          return;
        }
        
        const options = {
          strings: {},
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await message.reply(`❌ Could not find Discord user: ${args.discord_username}`);
            return;
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
        break;
      }
      
      default:
        await message.reply(`❌ Unknown command: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing command ${name}:`, error);
    await message.reply("⚠️ An error occurred while executing the command. Please try again.");
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
  
  // Only respond if bot is mentioned
  if (!message.mentions.has(client.user.id)) return;
  
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
      
      // Execute the command
      await executeCommand(responseMessage.function_call, message);
      
      // Add a note about function execution
      conversation.push({
        role: "function",
        name: responseMessage.function_call.name,
        content: "Function executed successfully"
      });
    } else {
      // ChatGPT responded conversationally (no function call)
      conversation.push({
        role: "assistant",
        content: responseMessage.content
      });
      
      await message.reply(responseMessage.content);
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

