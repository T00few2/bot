const express = require("express");
const app = express();

// Fake Web Server to Keep Render Free Tier
app.get("/", (req, res) => {
    res.send("Bot is running!");
});

app.listen(3000, () => {
    console.log("Fake web server running on port 3000");
});

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

// Create bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Define the /hello command
const commands = [
    new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Replies with Hello, @User!')
].map(command => command.toJSON());

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('Slash commands registered.');
    } catch (error) {
        console.error(error);
    }
})();

// Listen for interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'hello') {
        await interaction.reply(`Hello, ${interaction.user.username}!`);
    }
});

// When bot is ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Start bot
client.login(process.env.DISCORD_BOT_TOKEN);
