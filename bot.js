const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require("discord.js");
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
}, 10 * 60 * 1000); // Ping every 10 minutes

// 🚀 Load Firebase Config from Environment Variables
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

// 🎮 Handle Commands
client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    try {
        // Defer reply immediately to prevent Discord timeout errors (must respond within 3s)
        await interaction.deferReply();

        if (interaction.commandName === "hello") {
            await interaction.editReply(`Hello, ${interaction.user.username}!`);
        } 
        
        else if (interaction.commandName === "rider_stats") {
            const zwiftIDOption = interaction.options.getString("zwiftid");
            const discordUser = interaction.options.getUser("discorduser");
        
            let zwiftID = zwiftIDOption;
        
            try {
                // If a Discord user is mentioned, fetch the linked Zwift ID from Firestore
                if (!zwiftID && discordUser) {
                    console.log(`Fetching Zwift ID for Discord user: ${discordUser.tag} (${discordUser.id})`);
        
                    const doc = await db.collection("discord_users").doc(discordUser.id).get();
        
                    if (!doc.exists) {
                        await interaction.editReply(`❌ **${discordUser.username} has not linked their ZwiftID!**`);
                        return;
                    }
        
                    zwiftID = doc.data().zwiftID;
                }
        
                // If no Zwift ID is found, return an error
                if (!zwiftID) {
                    await interaction.editReply(`❌ **You must provide a ZwiftID or mention a Discord user who has linked one.**`);
                    return;
                }
        
                // Fetch Rider Stats from API
                const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
                const rider = response.data;
        
                if (!rider || !rider.name) {
                    await interaction.editReply(`❌ No data found for Zwift ID **${zwiftID}**.`);
                    return;
                }

                // 🎨 Create an embed for better formatting
                const embed = new EmbedBuilder()
                    .setColor("#0099ff")
                    .setTitle(`🏆 Rider Stats for ${rider.name}`)
                    .setURL(`https://www.zwiftpower.com/profile.php?z=${rider.riderId}`)
                    .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/c/cd/Zwift_logo.png") // Zwift logo
                    .addFields(
                        { name: "**Zwift Category**", value: `${rider.zpCategory}`, inline: true },
                        { name: "**vELO Category**", value: `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`, inline: true },
                        { name: "**FTP**", value: `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`, inline: true },
                        { name: "**CP**", value: `${rider.power.CP.toFixed(0)} W`, inline: true },
                        { name: "**Total Races**", value: `${rider.race.finishes}`, inline: true },
                        { name: "**Wins**", value: `${rider.race.wins}`, inline: true },
                        { name: "**Podiums**", value: `${rider.race.podiums}`, inline: true }
                    )
                    .addFields({ name: "📊 **Power Ratings**", value: "------------------------" })
                    .addFields(
                        { name: "5s Power", value: `${rider.power.w5} W (${rider.power.wkg5.toFixed(2)} W/kg)`, inline: true },
                        { name: "1m Power", value: `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`, inline: true },
                        { name: "5m Power", value: `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`, inline: true }
                    )
                    .setFooter({ text: "Data provided by ZwiftPower & ZwiftRacing.app" })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

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
