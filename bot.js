const express = require("express");
const axios = require("axios"); // Import axios for API requests
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
require("dotenv").config();

// Fake Web Server to Keep Render Free Tier
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Fake web server running on port 3000"));

// Create bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Define the commands
const commands = [
    new SlashCommandBuilder()
        .setName("hello")
        .setDescription("Replies with Hello, @User!"),
    new SlashCommandBuilder()
        .setName("rider_stats")
        .setDescription("Fetch rider stats for a given ZwiftID")
        .addStringOption(option =>
            option.setName("zwiftid")
                .setDescription("The Zwift ID to check")
                .setRequired(true)
        )
].map(command => command.toJSON());

// Register slash commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log("Registering slash commands...");
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log("✅ Slash commands registered.");
    } catch (error) {
        console.error("❌ Error registering commands:", error);
    }
})();

// Listen for interactions
client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "hello") {
        await interaction.reply(`Hello, ${interaction.user.username}!`);
    } else if (interaction.commandName === "rider_stats") {
        const zwiftID = interaction.options.getString("zwiftid");

        try {
            const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
            const rider = response.data;

            if (!rider || !rider.name) {
                await interaction.reply(`❌ No data found for Zwift ID **${zwiftID}**.`);
                return;
            }

            // Format the response
            const statsMessage = `**🏆 Rider Stats for ${rider.name} (ZwiftID: ${rider.riderId})**\n
- **Category**: ${rider.zpCategory}
- **FTP**: ${rider.zpFTP} W
- **Weight**: ${rider.weight} kg
- **Height**: ${rider.height} cm
- **Power Ratings**:
  - **5s:** ${rider.power.w5} W (${rider.power.wkg5} W/kg)
  - **1min:** ${rider.power.w60} W (${rider.power.wkg60} W/kg)
  - **5min:** ${rider.power.w300} W (${rider.power.wkg300} W/kg)
- **Race Category**: ${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(1)})
- **Total Races**: ${rider.race.finishes}
- **Wins**: 🥇 ${rider.race.wins} | **Podiums**: 🏆 ${rider.race.podiums}
- **Phenotype**: ${rider.phenotype.value} (${rider.phenotype.scores.puncheur}% Puncheur)`;

            await interaction.reply(statsMessage);
        } catch (error) {
            console.error("❌ API Fetch Error:", error);
            await interaction.reply(`⚠️ Error fetching data for Zwift ID **${zwiftID}**.`);
        }
    }
});

// When bot is ready
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Start bot
client.login(process.env.DISCORD_BOT_TOKEN);
