const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  AttachmentBuilder
} = require("discord.js");
const { createCanvas } = require("canvas"); // For image generation
require("dotenv").config();
const admin = require("firebase-admin");

// 🌍 Fake Web Server to Keep Render Free Tier
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Fake web server running on port 3000"));

// 🔄 Keep-Alive Ping
setInterval(async () => {
  try {
    await axios.get("https://bot-tdnm.onrender.com");
    console.log("✅ Keep-alive ping sent to prevent sleeping.");
  } catch (error) {
    console.error("❌ Keep-alive ping failed:", error);
  }
}, 10 * 60 * 1000);

// 🚀 Init Firebase
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

// 🤖 Discord Bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 1️⃣ Build the Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Replies with Hello, @User!"),

  new SlashCommandBuilder()
    .setName("rider_stats")
    .setDescription("Fetch single-rider stats by ZwiftID or Discord user mention")
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
    .setDescription("Retrieve your linked ZwiftID"),

  new SlashCommandBuilder()
    .setName("team_stats")
    .setDescription("Compare multiple riders' stats from today's club_stats data")
    .addUserOption(option =>
      option.setName("rider1")
        .setDescription("First Discord user to compare")
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName("rider2")
        .setDescription("Second Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName("rider3")
        .setDescription("Third Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName("rider4")
        .setDescription("Fourth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName("rider5")
        .setDescription("Fifth Discord user")
        .setRequired(false)
    )
].map(command => command.toJSON());

// 2️⃣ Register Slash Commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
})();

// 3️⃣ Generate Single-Rider Stats Image
async function generateRiderStatsImage(rider) {
  const width = 750;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px Arial";
  ctx.fillText(`Rider Stats for ${rider.name}`, 50, 50);

  ctx.font = "16px Arial";
  let startY = 100;

  ctx.fillText(`Zwift Category: ${rider.zpCategory}`, 50, startY);
  startY += 30;

  ctx.fillText(
    `vELO Category: ${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`,
    50, startY
  );
  startY += 30;

  ctx.fillText(
    `FTP: ${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`,
    50, startY
  );
  startY += 30;

  ctx.fillText(
    `CP: ${rider.power.CP.toFixed(0)} W`,
    50, startY
  );
  startY += 30;

  ctx.fillText(
    `Phenotype: ${rider.phenotype.value}`,
    50, startY
  );
  startY += 30;

  // Power Ratings block
  ctx.font = "bold 18px Arial";
  ctx.fillText("Power Ratings", 400, 100);

  ctx.font = "16px Arial";
  ctx.fillText(
    `5s: ${rider.power.w5} W (${rider.power.wkg5.toFixed(2)} W/kg)`,
    400, 130
  );
  ctx.fillText(
    `1m: ${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`,
    400, 160
  );
  ctx.fillText(
    `5m: ${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`,
    400, 190
  );

  return canvas.toBuffer();
}

// 4️⃣ Generate Multi-Rider Stats Image (team_stats)
async function generateTeamStatsImage(ridersArray) {
  const numCols = ridersArray.length;
  const colWidth = 200;
  const height = 400;
  const width = 100 + colWidth * numCols;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 20px Arial";
  ctx.fillText("Team Stats Comparison", 50, 40);

  ctx.font = "bold 16px Arial";
  const labels = ["Name", "Category", "FTP", "CP", "Phenotype"];

  let startY = 80;
  labels.forEach((label, i) => {
    ctx.fillText(label, 20, startY + i * 30);
  });

  ridersArray.forEach((rider, colIndex) => {
    const xOffset = 120 + colIndex * colWidth;
    let yOffset = 80;

    ctx.font = "16px Arial";
    ctx.fillText(rider.name, xOffset, yOffset);
    yOffset += 30;

    const catStr = `${rider.zpCategory} / ${rider.race.current.mixed.category}`;
    ctx.fillText(catStr, xOffset, yOffset);
    yOffset += 30;

    const ftpStr = `${rider.zpFTP} W`;
    ctx.fillText(ftpStr, xOffset, yOffset);
    yOffset += 30;

    const cpStr = `${rider.power.CP.toFixed(0)} W`;
    ctx.fillText(cpStr, xOffset, yOffset);
    yOffset += 30;

    const phenoStr = rider.phenotype.value;
    ctx.fillText(phenoStr, xOffset, yOffset);
  });

  return canvas.toBuffer();
}

// 5️⃣ Command Handling
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  try {
    await interaction.deferReply();

    // /hello
    if (interaction.commandName === "hello") {
      await interaction.editReply(`Hello, ${interaction.user.username}!`);
    }

    // /my_zwiftid
    else if (interaction.commandName === "my_zwiftid") {
      const zwiftID = interaction.options.getString("zwiftid");
      const discordID = interaction.user.id;
      const username = interaction.user.username;

      try {
        // 🔥 NOTE: storing in "discord_users" collection
        await db.collection("discord_users").doc(discordID).set({
          discordID,
          username,
          zwiftID,
          linkedAt: admin.firestore.Timestamp.now(),
        });
        await interaction.editReply(`✅ Your ZwiftID (${zwiftID}) is now linked to your Discord ID!`);
      } catch (error) {
        console.error("❌ Firebase Error:", error);
        await interaction.editReply(`⚠️ Error saving your ZwiftID.`);
      }
    }

    // /whoami
    else if (interaction.commandName === "whoami") {
      const discordID = interaction.user.id;
      try {
        // 🔥 reading from "discord_users"
        const doc = await db.collection("discord_users").doc(discordID).get();
        if (!doc.exists) {
          await interaction.editReply("❌ You haven't linked a ZwiftID yet! Use /my_zwiftid [ZwiftID].");
          return;
        }
        const data = doc.data();
        await interaction.editReply(`✅ Your linked ZwiftID: ${data.zwiftID}`);
      } catch (error) {
        console.error("❌ Firebase Error:", error);
        await interaction.editReply("⚠️ Error fetching your ZwiftID.");
      }
    }

    // /rider_stats
    else if (interaction.commandName === "rider_stats") {
      try {
        const zwiftIDOption = interaction.options.getString("zwiftid");
        const discordUser = interaction.options.getUser("discorduser");
        let zwiftID = zwiftIDOption;

        if (!zwiftID && discordUser) {
          console.log(`Fetching Zwift ID for Discord user: ${discordUser.tag} (${discordUser.id})`);
          // 🔥 reading from "discord_users"
          const doc = await db.collection("discord_users").doc(discordUser.id).get();
          if (!doc.exists) {
            await interaction.editReply(`❌ **${discordUser.username}** has not linked their ZwiftID yet!`);
            return;
          }
          zwiftID = doc.data().zwiftID;
        }

        if (!zwiftID) {
          await interaction.editReply("❌ You must provide a ZwiftID or mention a user who has linked one.");
          return;
        }

        const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
        const rider = response.data;
        if (!rider || !rider.name) {
          await interaction.editReply(`❌ No data found for Zwift ID **${zwiftID}**.`);
          return;
        }

        const imageBuffer = await generateRiderStatsImage(rider);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });
        await interaction.editReply({ content: "Here are the rider stats:", files: [attachment] });

      } catch (error) {
        console.error("❌ rider_stats Error:", error);
        await interaction.editReply("⚠️ Error fetching or generating rider stats.");
      }
    }

    // /team_stats
    else if (interaction.commandName === "team_stats") {
      const userMentions = [];
      for (let i = 1; i <= 5; i++) {
        const userOpt = interaction.options.getUser(`rider${i}`);
        if (userOpt) userMentions.push(userOpt);
      }

      if (userMentions.length === 0) {
        await interaction.editReply("❌ You must mention at least one Discord user.");
        return;
      }

      try {
        const discordToZwiftMap = {};
        for (const userObj of userMentions) {
          // 🔥 reading from "discord_users"
          const doc = await db.collection("discord_users").doc(userObj.id).get();
          if (!doc.exists) {
            await interaction.editReply(`❌ **${userObj.username}** has not linked a ZwiftID yet!`);
            return;
          }
          discordToZwiftMap[userObj.id] = doc.data().zwiftID;
        }

        const dateId = new Date().toISOString().split('T')[0];
        const clubDoc = await db.collection("club_stats").doc(dateId).get();
        if (!clubDoc.exists) {
          await interaction.editReply(`❌ No club_stats found for date: ${dateId}`);
          return;
        }

        const clubData = clubDoc.data();
        if (!clubData?.data?.riders) {
          await interaction.editReply("❌ This club_stats document has no riders array!");
          return;
        }

        const allRiders = clubData.data.riders;

        const ridersFound = [];
        for (const [discordId, zID] of Object.entries(discordToZwiftMap)) {
          const found = allRiders.find(r => r.riderId === parseInt(zID));
          if (!found) {
            await interaction.editReply(`❌ ZwiftID ${zID} not found in today's club_stats data.`);
            return;
          }
          ridersFound.push(found);
        }

        const imageBuffer = await generateTeamStatsImage(ridersFound);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "team_stats.png" });

        await interaction.editReply({ content: "Here is the team comparison:", files: [attachment] });

      } catch (error) {
        console.error("❌ team_stats Error:", error);
        await interaction.editReply("⚠️ Error generating team stats comparison.");
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
