const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { createCanvas } = require("canvas"); // For image generation
const crypto = require("crypto");          // For unique keys
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

/**
 * A global store for ephemeral results waiting to be published.
 * Key: a unique string
 * Value: { content: string, files?: AttachmentBuilder[] }
 */
const ephemeralStore = new Map();

/**
 * Utility function to store ephemeral content in ephemeralStore,
 * then edit the ephemeral reply to show a "Publish to Channel" button.
 */
async function ephemeralReplyWithPublish(interaction, content, files = []) {
  // 1) Generate a unique key
  const uniqueId = crypto.randomUUID();

  // 2) Store ephemeral data so we can publish it later
  ephemeralStore.set(uniqueId, { content, files });

  // 3) Create a "Publish" button
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish_${uniqueId}`)
      .setLabel("Publish to Channel")
      .setStyle(ButtonStyle.Primary)
  );

  // 4) Edit the ephemeral reply to add the "Publish" button
  await interaction.editReply({
    content,
    files,
    components: [row],
    ephemeral: true
  });
}

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
    ),

  new SlashCommandBuilder()
    .setName("browse_riders")
    .setDescription("Browse riders in today's club_stats by first 3 letters")
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters of the rider's name")
        .setRequired(true)
    )

].map(command => command.toJSON());

// 2️⃣ Register Slash Commands
const { REST, Routes } = require("discord.js");
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

// 3️⃣ Single-Rider Stats (13-row layout)
const { createCanvas } = require("canvas");
async function generateSingleRiderStatsImage(rider) {
  // ... identical logic from your snippet ...
  // (Just keep your existing function body)
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 80;
  const leftMargin = 20;
  const height = topMargin + (rowCount * rowHeight) + 80;
  const width = 600;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Rider Stats", 40, 40);

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

  let yOffset = topMargin;
  const xOffset = leftMargin + 150;
  ctx.font = "16px Arial";

  ctx.fillText(rider.name, xOffset, yOffset);           yOffset += rowHeight;
  ctx.fillText(rider.zpCategory, xOffset, yOffset);    yOffset += rowHeight;
  const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
  ctx.fillText(veloCat, xOffset, yOffset);             yOffset += rowHeight;
  ctx.fillText(rider.phenotype.value, xOffset, yOffset); yOffset += rowHeight;
  const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
  ctx.fillText(ftpString, xOffset, yOffset);           yOffset += rowHeight;
  const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
  ctx.fillText(w30String, xOffset, yOffset);           yOffset += rowHeight;
  const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
  ctx.fillText(w60String, xOffset, yOffset);           yOffset += rowHeight;
  const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
  ctx.fillText(w300String, xOffset, yOffset);          yOffset += rowHeight;
  const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
  ctx.fillText(w1200String, xOffset, yOffset);         yOffset += rowHeight;
  ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset); yOffset += rowHeight;
  ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);     yOffset += rowHeight;
  ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);  yOffset += rowHeight;
  ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);

  return canvas.toBuffer();
}

// 4️⃣ Multi-Rider Stats (13-row layout)
async function generateTeamStatsImage(ridersArray) {
  // ... identical logic from your snippet ...
  // (Keep your existing function body)
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 80;
  const leftMargin = 20;
  const numCols = ridersArray.length;
  const colWidth = 220; 
  const height = topMargin + (rowCount * rowHeight) + 80;
  const width = leftMargin + colWidth * numCols + 100;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Team Stats", 50, 40);

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

  ridersArray.forEach((rider, colIndex) => {
    const xOffset = leftMargin + 130 + colIndex * colWidth; 
    let yOffset = topMargin;
    ctx.font = "16px Arial";

    ctx.fillText(rider.name, xOffset, yOffset);         yOffset += rowHeight;
    ctx.fillText(rider.zpCategory, xOffset, yOffset);   yOffset += rowHeight;
    const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
    ctx.fillText(veloCat, xOffset, yOffset);            yOffset += rowHeight;
    ctx.fillText(rider.phenotype.value, xOffset, yOffset); yOffset += rowHeight;
    const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
    ctx.fillText(ftpString, xOffset, yOffset);          yOffset += rowHeight;
    const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
    ctx.fillText(w30String, xOffset, yOffset);          yOffset += rowHeight;
    const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
    ctx.fillText(w60String, xOffset, yOffset);          yOffset += rowHeight;
    const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
    ctx.fillText(w300String, xOffset, yOffset);         yOffset += rowHeight;
    const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
    ctx.fillText(w1200String, xOffset, yOffset);        yOffset += rowHeight;
    ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset); yOffset += rowHeight;
    ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);     yOffset += rowHeight;
    ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);  yOffset += rowHeight;
    ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);
  });

  return canvas.toBuffer();
}

// 5️⃣ Interaction Handling
client.on("interactionCreate", async interaction => {
  try {
    // (A) Handle "Publish" button
    if (interaction.isButton() && interaction.customId.startsWith("publish_")) {
      const uniqueId = interaction.customId.replace("publish_", "");
      const stored = ephemeralStore.get(uniqueId);
      if (!stored) {
        await interaction.reply({
          content: "❌ Could not find the content to publish.",
          ephemeral: true
        });
        return;
      }
      ephemeralStore.delete(uniqueId);

      // Defer to avoid "Interaction failed"
      await interaction.deferUpdate();

      // Post a brand-new public message
      await interaction.followUp({
        content: stored.content,
        files: stored.files ?? [],
        ephemeral: false
      });

      // Remove the publish button from ephemeral so it can't be clicked again
      await interaction.editReply({ components: [] });
      return;
    }

    // (B) If it's a StringSelectMenu for browse_riders
    if (interaction.isStringSelectMenu() && interaction.customId === "select_rider") {
      try {
        const [selectedValue] = interaction.values;
        await interaction.deferUpdate();
        await interaction.editReply({
          content: `You selected a rider with ZwiftID: **${selectedValue}**`,
          components: []
        });
      } catch (error) {
        console.error("❌ select_rider Error:", error);
        await interaction.editReply("⚠️ Error selecting rider.");
      }
      return;
    }

    // (C) If it's a slash command
    if (!interaction.isCommand()) return;

    // Defer ephemeral reply
    await interaction.deferReply({ ephemeral: true });

    const commandName = interaction.commandName;

    // /my_zwiftid
    if (commandName === "my_zwiftid") {
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
        const content = `✅ Your ZwiftID (${zwiftID}) is now linked to your Discord ID!`;
        await ephemeralReplyWithPublish(interaction, content);
      } catch (error) {
        console.error("❌ Firebase Error:", error);
        await interaction.editReply({ content: "⚠️ Error saving your ZwiftID." });
      }
    }

    // /whoami
    else if (commandName === "whoami") {
      const discordID = interaction.user.id;
      try {
        const doc = await db.collection("discord_users").doc(discordID).get();
        if (!doc.exists) {
          const content = "❌ You haven't linked a ZwiftID yet! Use /my_zwiftid [ZwiftID].";
          await ephemeralReplyWithPublish(interaction, content);
          return;
        }
        const data = doc.data();
        const content = `✅ Your linked ZwiftID: ${data.zwiftID}`;
        await ephemeralReplyWithPublish(interaction, content);
      } catch (error) {
        console.error("❌ Firebase Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching your ZwiftID." });
      }
    }

    // /rider_stats
    else if (commandName === "rider_stats") {
      try {
        const zwiftIDOption = interaction.options.getString("zwiftid");
        const discordUser = interaction.options.getUser("discorduser");
        let zwiftID = zwiftIDOption;

        if (!zwiftID && discordUser) {
          const doc = await db.collection("discord_users").doc(discordUser.id).get();
          if (!doc.exists) {
            await ephemeralReplyWithPublish(interaction, `❌ **${discordUser.username}** has not linked their ZwiftID yet!`);
            return;
          }
          zwiftID = doc.data().zwiftID;
        }

        if (!zwiftID) {
          await ephemeralReplyWithPublish(interaction, "❌ You must provide a ZwiftID or mention a user who has linked one.");
          return;
        }

        const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
        const rider = response.data;
        if (!rider || !rider.name) {
          await ephemeralReplyWithPublish(interaction, `❌ No data found for ZwiftID **${zwiftID}**.`);
          return;
        }

        const imageBuffer = await generateSingleRiderStatsImage(rider);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });
        const zwiftPowerLink = `[${rider.name}](<https://www.zwiftpower.com/profile.php?z=${rider.riderId}>)`;
        const content = `ZwiftPower Profile: ${zwiftPowerLink}\n\n`;

        await ephemeralReplyWithPublish(interaction, content, [attachment]);
      } catch (error) {
        console.error("❌ rider_stats Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching or generating rider stats." });
      }
    }

    // /team_stats
    else if (commandName === "team_stats") {
      try {
        const userMentions = [];
        for (let i = 1; i <= 8; i++) {
          const userOpt = interaction.options.getUser(`rider${i}`);
          if (userOpt) userMentions.push(userOpt);
        }

        if (userMentions.length === 0) {
          await ephemeralReplyWithPublish(interaction, "❌ You must mention at least one Discord user.");
          return;
        }

        const discordToZwiftMap = {};
        for (const userObj of userMentions) {
          const doc = await db.collection("discord_users").doc(userObj.id).get();
          if (!doc.exists) {
            await ephemeralReplyWithPublish(interaction, `❌ **${userObj.username}** has not linked a ZwiftID yet!`);
            return;
          }
          discordToZwiftMap[userObj.id] = doc.data().zwiftID;
        }

        const dateId = new Date().toISOString().split('T')[0];
        const clubDoc = await db.collection("club_stats").doc(dateId).get();
        if (!clubDoc.exists) {
          await ephemeralReplyWithPublish(interaction, `❌ No club_stats found for date: ${dateId}`);
          return;
        }

        const clubData = clubDoc.data();
        if (!clubData?.data?.riders) {
          await ephemeralReplyWithPublish(interaction, "❌ This club_stats document has no riders array!");
          return;
        }

        const allRiders = clubData.data.riders;
        const ridersFound = [];
        for (const [discordId, zID] of Object.entries(discordToZwiftMap)) {
          const found = allRiders.find(r => r.riderId === parseInt(zID));
          if (!found) {
            await ephemeralReplyWithPublish(interaction, `❌ ZwiftID ${zID} not found in today's club_stats data.`);
            return;
          }
          ridersFound.push(found);
        }

        const zPLinks = ridersFound
          .map(r => `[${r.name}](<https://www.zwiftpower.com/profile.php?z=${r.riderId}>)`)
          .join(" | ");

        const imageBuffer = await generateTeamStatsImage(ridersFound);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "team_stats.png" });
        const content = `ZwiftPower Profiles: ${zPLinks}\n\n`;

        await ephemeralReplyWithPublish(interaction, content, [attachment]);
      } catch (error) {
        console.error("❌ team_stats Error:", error);
        await interaction.editReply({ content: "⚠️ Error generating team stats comparison." });
      }
    }

    // /browse_riders
    else if (commandName === "browse_riders") {
      try {
        const searchTerm = interaction.options.getString("searchterm") || "";
        if (searchTerm.length < 3) {
          await ephemeralReplyWithPublish(interaction, "❌ Please provide at least 3 letters.");
          return;
        }

        const dateId = new Date().toISOString().split("T")[0];
        const clubDoc = await db.collection("club_stats").doc(dateId).get();
        if (!clubDoc.exists) {
          await ephemeralReplyWithPublish(interaction, `❌ No club_stats found for date: ${dateId}`);
          return;
        }

        const docData = clubDoc.data();
        if (!docData?.data?.riders) {
          await ephemeralReplyWithPublish(interaction, "❌ No riders array in today's club_stats!");
          return;
        }

        const allRiders = docData.data.riders;
        if (!Array.isArray(allRiders) || allRiders.length === 0) {
          await ephemeralReplyWithPublish(interaction, "❌ No riders found.");
          return;
        }

        const lowerSearch = searchTerm.toLowerCase();
        const matchingRiders = allRiders.filter(r =>
          r.name && r.name.toLowerCase().startsWith(lowerSearch)
        );

        if (matchingRiders.length === 0) {
          await ephemeralReplyWithPublish(interaction, `❌ No riders found starting with "${searchTerm}".`);
          return;
        }

        const options = matchingRiders.slice(0, 25).map(r => ({
          label: r.name.slice(0, 100),
          description: `ZwiftID: ${r.riderId}`,
          value: r.riderId.toString()
        }));

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_rider")
            .setPlaceholder("Select a rider…")
            .addOptions(options)
        );

        // Typically ephemeral, but let's not add a "Publish" button for a select menu
        await interaction.editReply({
          content: `**Found ${matchingRiders.length} riders** starting with "${searchTerm}". Select one:`,
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error("❌ browse_riders Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching rider list." });
      }
    }

  } catch (error) {
    console.error("❌ Unexpected Error:", error);
    if (!interaction.replied) {
      // final fallback ephemeral error
      await interaction.reply({ content: "⚠️ An unexpected error occurred!", ephemeral: true });
    }
  }
});

// ✅ Start Bot
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_BOT_TOKEN);
