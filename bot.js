const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const config = require("./config/config");
const commands = require("./commands/slashCommands");
const { setupKeepAliveServer } = require("./services/server");
const { handleInteractions } = require("./handlers/interactionHandler");
const { handleGuildMemberAdd } = require("./handlers/memberHandler");
const { startScheduler } = require("./services/scheduler");

// Setup keep-alive server
setupKeepAliveServer();

// Create Discord Bot Client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers  // Added for welcome messages and role management
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
client.on("interactionCreate", handleInteractions);

// Handle new members
client.on("guildMemberAdd", handleGuildMemberAdd);

// Bot ready event
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Start the message scheduler
  startScheduler(client);
});

// Start the bot
client.login(config.discord.token); 