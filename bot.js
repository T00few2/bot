const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const config = require("./config/config");
const commands = require("./commands/slashCommands");
const { setupKeepAliveServer } = require("./services/server");
const { handleInteractions } = require("./handlers/interactionHandler");
const { handleGuildMemberAdd } = require("./handlers/memberHandler");
const { startScheduler } = require("./services/scheduler");
const approvalService = require("./services/approvalService");
const { 
  handleMessageCreate, 
  handleMessageReactionAdd, 
  handleVoiceStateUpdate, 
  handleInteractionCreate,
  forceSaveStats 
} = require("./handlers/statsHandler");

// Setup keep-alive server
setupKeepAliveServer();

// Create Discord Bot Client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,  // Added for welcome messages and role management
    GatewayIntentBits.GuildMessages, // Added for activity stats
    GatewayIntentBits.GuildMessageReactions, // Added for reaction stats and approval reactions
    GatewayIntentBits.GuildVoiceStates, // Added for voice activity stats
    GatewayIntentBits.MessageContent // Added to read message content for stats
  ] 
});

// Register Slash Commands
const rest = new REST({ version: "10" }).setToken(config.discord.token);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands }
    );
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
})();

// Handle approval reactions
client.on("messageReactionAdd", async (reaction, user) => {
  // Handle stats collection
  handleMessageReactionAdd(reaction, user);

  // Handle approval reactions (skip if it's the bot itself)
  if (user.bot) return;

  try {
    // If reaction is partial, fetch it
    if (reaction.partial) {
      await reaction.fetch();
    }

    // Check if it's an approval reaction (✅ emoji)
    if (reaction.emoji.name === "✅") {
      const result = await approvalService.handleApprovalReaction(
        reaction.message.id, 
        user.id, 
        reaction.message.guild
      );

      if (result) {
        if (result.approved) {
          console.log(`✅ Role approval: ${result.requestData.roleName} approved for user ${result.requestData.userId} by ${result.approver.tag} (${result.approverType})`);
        } else if (result.error) {
          // Send a DM to the user who tried to approve without permission
          try {
            await user.send(`❌ **Permission Denied**\n\n${result.error}\n\n**Request Details:**\n• Role: ${result.requestData.roleName}\n• Panel: ${result.requestData.panelName}`);
          } catch (dmError) {
            console.log(`Could not send DM to ${user.tag}: ${dmError.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error handling approval reaction:", error);
  }
});

// Handle all interactions
client.on("interactionCreate", (interaction) => {
  handleInteractions(interaction);
  handleInteractionCreate(interaction); // Also track for stats
});

// Handle new members
client.on("guildMemberAdd", handleGuildMemberAdd);

// Handle activity for stats collection
client.on("messageCreate", handleMessageCreate);
client.on("voiceStateUpdate", handleVoiceStateUpdate);

// Bot ready event
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Start the message scheduler
  startScheduler(client);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🔄 Graceful shutdown initiated...');
  forceSaveStats();
  setTimeout(() => {
    console.log('👋 Bot shutting down');
    process.exit(0);
  }, 2000); // Give 2 seconds for stats to save
});

process.on('SIGTERM', () => {
  console.log('🔄 Graceful shutdown initiated...');
  forceSaveStats();
  setTimeout(() => {
    console.log('👋 Bot shutting down');
    process.exit(0);
  }, 2000);
});

// Start the bot
client.login(config.discord.token); 