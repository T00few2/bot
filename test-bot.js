const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const config = require("./config/config");

// Create Discord Bot Client
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds] 
});

// Simple interaction handler
client.on("interactionCreate", async (interaction) => {
  console.log(`🔍 TEST BOT: Handling interaction ${interaction.id}`);
  console.log(`State: replied=${interaction.replied}, deferred=${interaction.deferred}`);
  
  if (!interaction.isCommand()) return;
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: `✅ Test response for /${interaction.commandName}`, 
        flags: MessageFlags.Ephemeral 
      });
      console.log("✅ TEST BOT: Successfully replied");
    } else {
      console.log("⚠️ TEST BOT: Already acknowledged");
    }
  } catch (error) {
    console.error("❌ TEST BOT Error:", error);
  }
});

// Bot ready event
client.once("ready", () => {
  console.log(`✅ TEST BOT: Logged in as ${client.user.tag}`);
});

// Start the bot
client.login(config.discord.token); 