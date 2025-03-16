const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require("discord.js");
const { createCanvas } = require("canvas"); // Required for image generation
require("dotenv").config();
const admin = require("firebase-admin");

// 🌍 Fake Web Server to Keep Render Free Tier
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Fake web server running on port 3000"));

// 🔄 Keep-Alive Ping Every 10 Minutes
setInterval(async () => {
    try {
        await axios.get("https://bot-tdnm.onrender.com");
        console.log("✅ Keep-alive ping sent to prevent sleeping.");
    } catch (error) {
        console.error("❌ Keep-alive ping failed:", error);
    }
}, 10 * 60 * 1000);

// 🚀 Load Firebase Config
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!privateKey) {
    throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

const db = admin.firestore();

// 🤖 Create Discord Bot Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📝 Define Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName("hello")
        .setDescription("Replies with Hello, @User!"),
    new SlashCommandBuilder()
        .setName("rider_stats")
        .setDescription("Fetch rider stats for a given ZwiftID or Discord user")
        .addStringOption(option =>
            option.setName("zwiftid")
                .setDescription("The Zwift ID to check")
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName("discorduser")
                .setDescription("Mention a Discord user to fetch their linked ZwiftID")
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName("my_zwiftid")
        .setDescription("Link your Discord ID to a ZwiftID")
        .addStringOption(option =>
            option.setName("zwiftid")
                .setDescription("Your Zwift ID")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("whoami")
        .setDescription("Retrieve your linked ZwiftID")
].map(command => command.toJSON());

// 🛠️ Register Slash Commands
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

// 🎨 Function to Generate Table Image
async function generateStatsImage(rider) {
    const width = 800, height = 500; // Canvas size
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff"; // White background
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#000000"; // Black text
    ctx.font = "bold 24px Arial";
    ctx.fillText(`🏆 Rider Stats for ${rider.name}, ${rider.club.name}`, 50, 50);

    // Table Headers
    ctx.font = "bold 18px Arial";
    ctx.fillText("Zwift Category", 50, 100);
    ctx.fillText("vELO Category", 250, 100);
    ctx.fillText("Phenotype", 450, 100);

    // Data Rows
    ctx.font = "16px Arial";
    ctx.fillText(rider.zpCategory, 50, 130);
    ctx.fillText(`${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`, 250, 130);
    ctx.fillText(rider.phenotype.value, 450, 130);

    // Power Ratings Header
    ctx.font = "bold 18px Arial";
    ctx.fillText("📊 Power Ratings", 50, 180);

    // Power Data
    ctx.font = "16px Arial";
    ctx.fillText(`30s Power: ${rider.power.w30} W`, 50, 210);
    ctx.fillText(`5m Power: ${rider.power.w300} W`, 250, 210);
    ctx.fillText(`20m Power: ${rider.power.w1200} W`, 450, 210);

    ctx.fillText(`30s W/kg: ${rider.power.wkg30.toFixed(2)} W/kg`, 50, 240);
    ctx.fillText(`5m W/kg: ${rider.power.wkg300.toFixed(2)} W/kg`, 250, 240);
    ctx.fillText(`20m W/kg: ${rider.power.wkg1200.toFixed(2)} W/kg`, 450, 240);

    return canvas.toBuffer();
}

// 🎮 Handle Commands
client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    try {
        await interaction.deferReply();

        if (interaction.commandName === "hello") {
            await interaction.editReply(`Hello, ${interaction.user.username}!`);
        } 

        else if (interaction.commandName === "rider_stats") {
            const zwiftIDOption = interaction.options.getString("zwiftid");
            const discordUser = interaction.options.getUser("discorduser");
        
            let zwiftID = zwiftIDOption;
        
            try {
                // Fetch Zwift ID if user is mentioned
                if (!zwiftID && discordUser) {
                    console.log(`Fetching Zwift ID for Discord user: ${discordUser.tag} (${discordUser.id})`);
        
                    const doc = await db.collection("discord_users").doc(discordUser.id).get();
        
                    if (!doc.exists) {
                        await interaction.editReply(`❌ **${discordUser.username} has not linked their ZwiftID!**`);
                        return;
                    }
        
                    zwiftID = doc.data().zwiftID;
                }
        
                if (!zwiftID) {
                    await interaction.editReply(`❌ **You must provide a ZwiftID or mention a Discord user who has linked one.**`);
                    return;
                }
        
                // Fetch Rider Stats
                const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
                const rider = response.data;
        
                if (!rider || !rider.name) {
                    await interaction.editReply(`❌ No data found for Zwift ID **${zwiftID}**.`);
                    return;
                }

                // Generate and send image
                const imageBuffer = await generateStatsImage(rider);
                const attachment = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });

                await interaction.editReply({ content: "Here are the rider stats:", files: [attachment] });

            } catch (error) {
                console.error("❌ API Fetch Error:", error);
                await interaction.editReply(`⚠️ Error fetching data for Zwift ID **${zwiftID}**.`);
            }
        }
    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        if (!interaction.replied) {
            await interaction.reply({ content: "⚠️ An unexpected error occurred!", ephemeral: true });
        }
    }
});

// ✅ Start Bot
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_BOT_TOKEN);
