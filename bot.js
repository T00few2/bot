const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const config = require("./config/config");
const commands = require("./commands/slashCommands");
const { setupKeepAliveServer } = require("./services/server");
const { handleInteractions } = require("./handlers/interactionHandler");
const { handleGuildMemberAdd } = require("./handlers/memberHandler");
const { startScheduler } = require("./services/scheduler");
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
    GatewayIntentBits.GuildMessageReactions, // Added for reaction stats
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

// Handle all interactions
client.on("interactionCreate", (interaction) => {
  handleInteractions(interaction);
  handleInteractionCreate(interaction); // Also track for stats
});

// Handle new members
client.on("guildMemberAdd", handleGuildMemberAdd);

// Handle activity for stats collection
client.on("messageCreate", handleMessageCreate);
client.on("messageReactionAdd", handleMessageReactionAdd);
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