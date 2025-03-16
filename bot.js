const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
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
const firebaseConfig = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix newline issue
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
};

// ✅ Initialize Firebase
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey.replace(/\\n/g, '\n'), // Convert escaped newlines
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
        
                // Format Rider Stats
                const statsMessage = `
                **🏆 Rider Stats for ${rider.name} (ZwiftID: ${rider.riderId})**\n
                - **Zwift Category**: ${rider.zpCategory}
                - **vELO Category**: ${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})
                - **FTP**: ${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)
                - **CP**: ${rider.power.CP.toFixed(0)} W
                - **Total Races**: ${rider.race.finishes}
                **🥇 Wins**: ${rider.race.wins} | **🏅 Podiums**: ${rider.race.podiums}
                - **Power Ratings**:
                  - **5s:** ${rider.power.w5} W (${rider.power.wkg5.toFixed(2)} W/kg)
                  - **1m:** ${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)
                  - **5m:** ${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)
        
                [ZwiftPower Profile](https://www.zwiftpower.com/profile.php?z=${rider.riderId}) | [ZwiftRacing Profile](https://www.zwiftracing.app/riders/${rider.riderId})
                `;
        
                await interaction.editReply(statsMessage);
            } catch (error) {
                console.error("❌ API Fetch Error:", error);
                await interaction.editReply(`⚠️ Error fetching data for Zwift ID **${zwiftID}**.`);
            }
        }

        else if (interaction.commandName === "my_zwiftid") {
            const zwiftID = interaction.options.getString("zwiftid");
            const discordID = interaction.user.id;
            const username = interaction.user.username;

            try {
                await db.collection("discord_users").doc(discordID).set({
                    discordID,
                    username,
                    zwiftID,
                    linkedAt: admin.firestore.Timestamp.now(),
                });

                await interaction.editReply(`✅ **Your ZwiftID (${zwiftID}) is now linked to your Discord ID!**`);
            } catch (error) {
                console.error("❌ Firebase Error:", error);
                await interaction.editReply(`⚠️ **Error saving your ZwiftID.**`);
            }
        }

        else if (interaction.commandName === "whoami") {
            const discordID = interaction.user.id;

            try {
                const doc = await db.collection("discord_users").doc(discordID).get();

                if (!doc.exists) {
                    await interaction.editReply(`❌ **You haven't linked a ZwiftID yet! Use /my_zwiftid [ZwiftID] to link.**`);
                    return;
                }

                const data = doc.data();
                await interaction.editReply(`✅ **Your linked ZwiftID: ${data.zwiftID}**`);
            } catch (error) {
                console.error("❌ Firebase Error:", error);
                await interaction.editReply(`⚠️ **Error fetching your ZwiftID.**`);
            }
        }
    } catch (error) {
        console.error("❌ Unexpected Error in Command Handling:", error);

        // If interaction isn't already replied, send an error message
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
