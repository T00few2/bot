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

// 1️⃣ Define Slash Commands
const commands = [
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
    .addUserOption(option =>
      option.setName("rider6")
        .setDescription("Sixth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName("rider7")
        .setDescription("Seventh Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName("rider8")
        .setDescription("Eighth Discord user")
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

// 3️⃣ Single-Rider Stats: Same Layout But 1 Column
async function generateSingleRiderStatsImage(rider) {
  /**
   * We have 13 rows:
   * 1) Name
   * 2) Pace Group
   * 3) vELO Category
   * 4) Phenotype
   * 5) FTP
   * 6) 30s
   * 7) 1m
   * 8) 5m
   * 9) 20m
   * 10) Finishes
   * 11) Wins
   * 12) Podiums
   * 13) DNFs
   */

  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 80;
  const leftMargin = 20;

  const height = topMargin + (rowCount * rowHeight) + 80; // extra buffer
  const width = 600;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // White BG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Rider Stats", 40, 40);

  // Row labels
  ctx.font = "bold 16px Arial";
  const labels = [
    "Name",
    "Pace Group",
    "vELO Category",
    "Phenotype",
    "FTP",
    "30s",
    "1m",
    "5m",
    "20m",
    "Finishes",
    "Wins",
    "Podiums",
    "DNFs"
  ];

  labels.forEach((label, i) => {
    ctx.fillText(label, leftMargin, topMargin + (i * rowHeight));
  });

  // Values
  let yOffset = topMargin;
  const xOffset = leftMargin + 150;

  ctx.font = "16px Arial";

  // 1) Name
  ctx.fillText(rider.name, xOffset, yOffset);
  yOffset += rowHeight;

  // 2) Pace Group
  ctx.fillText(rider.zpCategory, xOffset, yOffset);
  yOffset += rowHeight;

  // 3) vELO Category
  const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
  ctx.fillText(veloCat, xOffset, yOffset);
  yOffset += rowHeight;

  // 4) Phenotype
  ctx.fillText(rider.phenotype.value, xOffset, yOffset);
  yOffset += rowHeight;

  // 5) FTP => e.g. 281 W (3.56 W/kg)
  const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
  ctx.fillText(ftpString, xOffset, yOffset);
  yOffset += rowHeight;

  // 6) 30s
  const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
  ctx.fillText(w30String, xOffset, yOffset);
  yOffset += rowHeight;

  // 7) 1m
  const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
  ctx.fillText(w60String, xOffset, yOffset);
  yOffset += rowHeight;

  // 8) 5m
  const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
  ctx.fillText(w300String, xOffset, yOffset);
  yOffset += rowHeight;

  // 9) 20m
  const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
  ctx.fillText(w1200String, xOffset, yOffset);
  yOffset += rowHeight;

  // 10) Finishes
  ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset);
  yOffset += rowHeight;

  // 11) Wins
  ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);
  yOffset += rowHeight;

  // 12) Podiums
  ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);
  yOffset += rowHeight;

  // 13) DNFs
  ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);

  return canvas.toBuffer();
}

// 4️⃣ Generate Multi-Rider Stats Image (team_stats) with 13 Rows
async function generateTeamStatsImage(ridersArray) {
  /**
   * 13 rows total:
   *  1) Name
   *  2) Pace Group
   *  3) vELO Category
   *  4) Phenotype
   *  5) FTP
   *  6) 30s
   *  7) 1m
   *  8) 5m
   *  9) 20m
   * 10) Finishes
   * 11) Wins
   * 12) Podiums
   * 13) DNFs
   */

  const numCols = ridersArray.length;
  const colWidth = 220; 
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 80;
  const leftMargin = 20;

  const height = topMargin + (rowCount * rowHeight) + 80;
  const width = leftMargin + colWidth * numCols + 100;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Team Stats", 50, 40);

  // Row Labels
  ctx.font = "bold 16px Arial";
  const labels = [
    "Name",
    "Pace Group",
    "vELO Category",
    "Phenotype",
    "FTP",
    "30s",
    "1m",
    "5m",
    "20m",
    "Finishes",
    "Wins",
    "Podiums",
    "DNFs"
  ];

  labels.forEach((label, i) => {
    ctx.fillText(label, leftMargin, topMargin + (i * rowHeight));
  });

  // Fill each rider's column
  ridersArray.forEach((rider, colIndex) => {
    const xOffset = leftMargin + 130 + colIndex * colWidth; 
    let yOffset = topMargin;

    ctx.font = "16px Arial";

    // 1) Name
    ctx.fillText(rider.name, xOffset, yOffset);
    yOffset += rowHeight;

    // 2) Pace Group
    ctx.fillText(rider.zpCategory, xOffset, yOffset);
    yOffset += rowHeight;

    // 3) vELO Category
    const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
    ctx.fillText(veloCat, xOffset, yOffset);
    yOffset += rowHeight;

    // 4) Phenotype
    ctx.fillText(rider.phenotype.value, xOffset, yOffset);
    yOffset += rowHeight;

    // 5) FTP
    const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
    ctx.fillText(ftpString, xOffset, yOffset);
    yOffset += rowHeight;

    // 6) 30s
    const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
    ctx.fillText(w30String, xOffset, yOffset);
    yOffset += rowHeight;

    // 7) 1m
    const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
    ctx.fillText(w60String, xOffset, yOffset);
    yOffset += rowHeight;

    // 8) 5m
    const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
    ctx.fillText(w300String, xOffset, yOffset);
    yOffset += rowHeight;

    // 9) 20m
    const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
    ctx.fillText(w1200String, xOffset, yOffset);
    yOffset += rowHeight;

    // 10) Finishes
    ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset);
    yOffset += rowHeight;

    // 11) Wins
    ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);
    yOffset += rowHeight;

    // 12) Podiums
    ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);
    yOffset += rowHeight;

    // 13) DNFs
    ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);
  });

  return canvas.toBuffer();
}

// 6️⃣ Command Handling
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  try {
    await interaction.deferReply();

    // /my_zwiftid
    if (interaction.commandName === "my_zwiftid") {
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

    // /rider_stats  (Single-rider with new 13-row layout)
    else if (interaction.commandName === "rider_stats") {
        try {
          const zwiftIDOption = interaction.options.getString("zwiftid");
          const discordUser = interaction.options.getUser("discorduser");
          let zwiftID = zwiftIDOption;
      
          // If no direct Zwift ID, but user mention
          if (!zwiftID && discordUser) {
            console.log(`Fetching Zwift ID for Discord user: ${discordUser.tag} (${discordUser.id})`);
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
      
          // Fetch from external API
          const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
          const rider = response.data;
          if (!rider || !rider.name) {
            await interaction.editReply(`❌ No data found for Zwift ID **${zwiftID}**.`);
            return;
          }
      
          // Generate single-rider image (13 rows)
          const imageBuffer = await generateSingleRiderStatsImage(rider);
          const attachment = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });
      
          // Build ZwiftPower Link
          const zwiftPowerLink = `[${rider.name}](<https://www.zwiftpower.com/profile.php?z=${rider.riderId}>)`;
      
          await interaction.editReply({
            content: `ZwiftPower Profile: ${zwiftPowerLink}\n\n`,
            files: [attachment],
          });
      
        } catch (error) {
          console.error("❌ rider_stats Error:", error);
          await interaction.editReply("⚠️ Error fetching or generating rider stats.");
        }
      }
      

    // /team_stats (multi-rider with 13-row layout)
    else if (interaction.commandName === "team_stats") {
      // 1) Collect up to 8 user mentions
      const userMentions = [];
      for (let i = 1; i <= 8; i++) {
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
          const doc = await db.collection("discord_users").doc(userObj.id).get();
          if (!doc.exists) {
            await interaction.editReply(`❌ **${userObj.username}** has not linked a ZwiftID yet!`);
            return;
          }
          discordToZwiftMap[userObj.id] = doc.data().zwiftID;
        }

        // 2) Get today's club_stats doc
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

        // 3) For each Zwift ID, find matching rider
        const ridersFound = [];
        for (const [discordId, zID] of Object.entries(discordToZwiftMap)) {
          const found = allRiders.find(r => r.riderId === parseInt(zID));
          if (!found) {
            await interaction.editReply(`❌ ZwiftID ${zID} not found in today's club_stats data.`);
            return;
          }
          ridersFound.push(found);
        }

        // 4) Build ZwiftPower links
        const zPLinks = ridersFound
          .map(r => `[${r.name}](<https://www.zwiftpower.com/profile.php?z=${r.riderId}>)`)
          .join(" | ");

        // 5) Generate multi-rider image
        const imageBuffer = await generateTeamStatsImage(ridersFound);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "team_stats.png" });

        // 6) Single message: links + image
        await interaction.editReply({
          content: `ZwiftPower Profiles: ${zPLinks}\n\n`,
          files: [attachment]
        });

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
