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
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");
const { createCanvas, loadImage } = require("canvas"); // For image generation
const crypto = require("crypto");          // For unique ephemeral keys
require("dotenv").config();
const admin = require("firebase-admin");

// Import the graph function from powerGraph.js
const { generatePowerLineGraph, generatePowerLineGraph2 } = require("./powerGraph");

// 1️⃣ Fake Web Server (to keep Render awake)
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Fake web server running on port 3000"));

// 2️⃣ Keep-Alive Ping
setInterval(async () => {
  try {
    await axios.get("https://bot-tdnm.onrender.com");
    console.log("✅ Keep-alive ping sent to prevent sleeping.");
  } catch (error) {
    console.error("❌ Keep-alive ping failed:", error);
  }
}, 10 * 60 * 1000);

// 3️⃣ Initialize Firebase
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
}
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});
const db = admin.firestore();

// 4️⃣ Create Discord Bot Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/**
 * A global store for ephemeral results.
 * Maps a unique key => { content, files } to allow "Publish to Channel."
 */
const ephemeralStore = new Map();

/**
 * Utility: ephemeralReplyWithPublish
 *  - Generates a unique ID
 *  - Stores ephemeral content in ephemeralStore
 *  - Edits the ephemeral reply to include the content and a "Publish to Channel" button
 */
async function ephemeralReplyWithPublish(interaction, content, files = []) {
  const uniqueId = crypto.randomUUID();
  ephemeralStore.set(uniqueId, { content, files });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish_${uniqueId}`)
      .setLabel("Publish to Channel")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({
    content,
    files,
    components: [row],
    ephemeral: true
  });
}

// 5️⃣ Define Slash Commands
const commands = [
  // rider_stats
  new SlashCommandBuilder()
    .setName("rider_stats")
    .setDescription("Fetch single-rider stats by ZwiftID or Discord user mention")
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("The Zwift ID to check")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("Mention a Discord user to fetch their linked ZwiftID")
        .setRequired(false)
    ),
  // my_zwiftid (self-linking; direct or search-based)
  new SlashCommandBuilder()
    .setName("my_zwiftid")
    .setDescription("Link your Discord ID to a ZwiftID (direct or via search)")
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("Your Zwift ID")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters of your name in the club stats")
        .setRequired(false)
    ),
  // whoami
  new SlashCommandBuilder()
    .setName("whoami")
    .setDescription("Retrieve your linked ZwiftID"),
  // team_stats
  new SlashCommandBuilder()
    .setName("team_stats")
    .setDescription("Compare multiple riders' stats from today's club_stats data")
    .addUserOption(option =>
      option
        .setName("rider1")
        .setDescription("First Discord user to compare")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("rider2")
        .setDescription("Second Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider3")
        .setDescription("Third Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider4")
        .setDescription("Fourth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider5")
        .setDescription("Fifth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider6")
        .setDescription("Sixth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider7")
        .setDescription("Seventh Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider8")
        .setDescription("Eighth Discord user")
        .setRequired(false)
    ),
  // browse_riders
  new SlashCommandBuilder()
    .setName("browse_riders")
    .setDescription("Browse riders in today's club_stats by first 3 letters")
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters of the rider's name")
        .setRequired(true)
    ),
  // NEW: set_zwiftid (for setting another user's linked ZwiftID)
  new SlashCommandBuilder()
    .setName("set_zwiftid")
    .setDescription("Set the ZwiftID for a specified Discord user (direct or via search)")
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("The Discord user to update")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("The ZwiftID to set")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters to search for the rider")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
    
  // NEW: get_zwiftid (for retrieving a user's linked ZwiftID)
  new SlashCommandBuilder()
    .setName("get_zwiftid")
    .setDescription("Get the linked ZwiftID for a specified Discord user")
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("The Discord user to query")
        .setRequired(true)
    ),
  // event_results
  new SlashCommandBuilder()
    .setName("event_results")
    .setDescription("Get team results from events matching a search string")
    .addStringOption(option =>
      option
        .setName("search")
        .setDescription("Search string to match in event titles")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// 6️⃣ Register Slash Commands
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

// 7️⃣ Layout Functions

function roundRect(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  return ctx;
}

async function generateSingleRiderStatsImage(rider) {
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 150;
  const leftMargin = 50;
  const width = 450;
  const height = topMargin + rowCount * rowHeight + 40;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  roundRect(ctx, 0, 0, canvas.width, canvas.height, 30);
  ctx.clip();

  // Background
  ctx.fillStyle = "#FF6719";
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.1;
  try {
    const image = await loadImage("zwifters.png");
    ctx.drawImage(image, width * 0.1, topMargin, width * 0.8, width * 0.8);
  } catch (err) {
    console.error("Failed to load image:", err);
  }
  ctx.globalAlpha = 1.0;

  // Horizontal line under title
  ctx.beginPath();
  ctx.moveTo(leftMargin, 90);
  ctx.lineTo(width - leftMargin, 90);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // Title text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 30px Arial";
  ctx.fillText("Rider Stats", leftMargin, 70);

  // Row labels
  ctx.font = "bold 22px Arial";
  const labels = [
    "Name", "Pace Group", "vELO Category", "Phenotype",
    "FTP", "30s", "1m", "5m", "20m",
    "Finishes", "😁 Wins", "☺️ Podiums", "😖 DNFs"
  ];
  labels.forEach((label, i) => {
    ctx.fillText(label, leftMargin, topMargin + i * rowHeight);
  });

  // Values
  ctx.font = "bold 16px Arial";
  let yOffset = topMargin;
  const xOffset = leftMargin + 180;
  ctx.fillText(rider.name, xOffset, yOffset);           yOffset += rowHeight;
  ctx.fillText(rider.zpCategory, xOffset, yOffset);       yOffset += rowHeight;
  const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
  ctx.fillText(veloCat, xOffset, yOffset);                yOffset += rowHeight;
  ctx.fillText(rider.phenotype.value, xOffset, yOffset);  yOffset += rowHeight;
  const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
  ctx.fillText(ftpString, xOffset, yOffset);              yOffset += rowHeight;
  const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
  ctx.fillText(w30String, xOffset, yOffset);              yOffset += rowHeight;
  const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
  ctx.fillText(w60String, xOffset, yOffset);              yOffset += rowHeight;
  const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
  ctx.fillText(w300String, xOffset, yOffset);             yOffset += rowHeight;
  const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
  ctx.fillText(w1200String, xOffset, yOffset);            yOffset += rowHeight;
  ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset); yOffset += rowHeight;
  ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);     yOffset += rowHeight;
  ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);  yOffset += rowHeight;
  ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);

  return canvas.toBuffer();
}

async function generateTeamStatsImage(ridersArray) {
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 150;
  const leftMargin = 50;
  const colWidth = 220;
  const numCols = ridersArray.length;
  const width = leftMargin + colWidth * numCols + 180;
  const height = topMargin + rowCount * rowHeight + 40;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  roundRect(ctx, 0, 0, width, height, 30);
  ctx.clip();

  // Background
  ctx.fillStyle = "#FF6719";
  ctx.fillRect(0, 0, width, height);

  // Watermark with low opacity
  ctx.globalAlpha = 0.1;
  try {
    const image = await loadImage("zwifters.png");
    const imgWidth = height * 0.7;
    ctx.drawImage(image, width / 2 - imgWidth / 2, topMargin + 10, imgWidth, imgWidth);
  } catch (err) {
    console.error("Failed to load image:", err);
  }
  ctx.globalAlpha = 1.0;

  // Horizontal line under title
  ctx.beginPath();
  ctx.moveTo(leftMargin, 90);
  ctx.lineTo(width - leftMargin, 90);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // Title text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 30px Arial";
  ctx.fillText("Team Stats", leftMargin, 70);

  // Row labels
  ctx.font = "bold 22px Arial";
  const labels = [
    "Name", "Pace Group", "vELO Category", "Phenotype",
    "FTP", "30s", "1m", "5m", "20m",
    "Finishes", "😁 Wins", "☺️ Podiums", "😖 DNFs"
  ];
  labels.forEach((label, i) => {
    ctx.fillText(label, leftMargin, topMargin + i * rowHeight);
  });

  // For each rider (each column)
  ctx.font = "bold 16px Arial";
  for (let col = 0; col < numCols; col++) {
    const rider = ridersArray[col];
    let yOffset = topMargin;
    const xOffset = leftMargin + 180 + col * colWidth;
    ctx.fillText(rider.name, xOffset, yOffset);         yOffset += rowHeight;
    ctx.fillText(rider.zpCategory, xOffset, yOffset);     yOffset += rowHeight;
    const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
    ctx.fillText(veloCat, xOffset, yOffset);              yOffset += rowHeight;
    ctx.fillText(rider.phenotype.value, xOffset, yOffset);  yOffset += rowHeight;
    const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
    ctx.fillText(ftpString, xOffset, yOffset);            yOffset += rowHeight;
    const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
    ctx.fillText(w30String, xOffset, yOffset);            yOffset += rowHeight;
    const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
    ctx.fillText(w60String, xOffset, yOffset);            yOffset += rowHeight;
    const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
    ctx.fillText(w300String, xOffset, yOffset);           yOffset += rowHeight;
    const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
    ctx.fillText(w1200String, xOffset, yOffset);          yOffset += rowHeight;
    ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset); yOffset += rowHeight;
    ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);     yOffset += rowHeight;
    ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);  yOffset += rowHeight;
    ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);
  }

  return canvas.toBuffer();
}

// 9️⃣ Interaction Handling
client.on("interactionCreate", async interaction => {
  try {
    // (A) If user clicked "Publish" button
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
      await interaction.deferUpdate();
      await interaction.followUp({
        content: stored.content,
        files: stored.files ?? [],
        ephemeral: false
      });
      await interaction.editReply({ components: [] });
      return;
    }

    // (B) If user selected from a select menu
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "select_rider") {
        try {
          const [selectedValue] = interaction.values;
          await interaction.deferUpdate();
          const dateId = new Date().toISOString().split("T")[0];
          const clubDoc = await db.collection("club_stats").doc(dateId).get();
          if (!clubDoc.exists) {
            await interaction.editReply("❌ No club_stats found for today.");
            return;
          }
          const docData = clubDoc.data();
          if (!docData?.data?.riders) {
            await interaction.editReply("❌ No riders array in today's club_stats!");
            return;
          }
          const allRiders = docData.data.riders;
          const chosen = allRiders.find(r => r.riderId === parseInt(selectedValue));
          if (!chosen) {
            await interaction.editReply("❌ Could not find that rider in today's list!");
            return;
          }
          const content = `**${chosen.name}** has ZwiftID: **${chosen.riderId}**`;
          await ephemeralReplyWithPublish(interaction, content);
        } catch (error) {
          console.error("❌ select_rider Error:", error);
          if (!interaction.replied) {
            await interaction.editReply("⚠️ Error selecting rider.");
          }
        }
        return;
      } else if (interaction.customId === "myzwift_select") {
        try {
          const [selectedValue] = interaction.values;
          await interaction.deferUpdate();
          const discordID = interaction.user.id;
          const username = interaction.user.username;
          await db.collection("discord_users").doc(discordID).set({
            discordID,
            username,
            zwiftID: selectedValue,
            linkedAt: admin.firestore.Timestamp.now(),
          });
          const content = `✅ You have selected rider ZwiftID: **${selectedValue}**. It is now linked to your Discord profile!`;
          await ephemeralReplyWithPublish(interaction, content);
        } catch (error) {
          console.error("❌ myzwift_select error:", error);
          if (!interaction.replied) {
            await interaction.editReply("⚠️ Error linking ZwiftID.");
          }
        }
        return;
      } else if (interaction.customId.startsWith("setzwift_select_")) {
        try {
          // Custom select for /set_zwiftid command: customId format: setzwift_select_<targetUserId>
          const parts = interaction.customId.split("_");
          const targetUserId = parts[2];
          const [selectedValue] = interaction.values;
          await interaction.deferUpdate();
          const targetUser = await client.users.fetch(targetUserId);
          await db.collection("discord_users").doc(targetUserId).set({
            discordID: targetUserId,
            username: targetUser.username,
            zwiftID: selectedValue,
            linkedAt: admin.firestore.Timestamp.now(),
          });
          const content = `✅ Linked ZwiftID **${selectedValue}** to ${targetUser.username}.`;
          await ephemeralReplyWithPublish(interaction, content);
        } catch (error) {
          console.error("❌ setzwift_select error:", error);
          if (!interaction.replied) {
            await interaction.editReply("⚠️ Error linking ZwiftID.");
          }
        }
        return;
      }
    }

    // (C) If slash command
    if (!interaction.isCommand()) return;
    await interaction.deferReply({ ephemeral: true });
    const commandName = interaction.commandName;

    // my_zwiftid (self-linking)
    if (commandName === "my_zwiftid") {
      const zwiftID = interaction.options.getString("zwiftid");
      const searchTerm = interaction.options.getString("searchterm");
      const discordID = interaction.user.id;
      const username = interaction.user.username;
      if (zwiftID) {
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
        return;
      }
      if (searchTerm) {
        if (searchTerm.length < 3) {
          await ephemeralReplyWithPublish(interaction, "❌ Please provide at least 3 letters!");
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
        const allRiders = docData.data.riders || [];
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
            .setCustomId("myzwift_select")
            .setPlaceholder("Select your name…")
            .addOptions(options)
        );
        await interaction.editReply({
          content: `**Found ${matchingRiders.length} riders** matching "${searchTerm}". Select your name:`,
          components: [row],
          ephemeral: true
        });
        return;
      }
      await ephemeralReplyWithPublish(interaction, "❌ Provide either `zwiftid:` or `searchterm:` to link.");
    }
    // set_zwiftid (for setting another user's ZwiftID)
    else if (commandName === "set_zwiftid") {
      const targetUser = interaction.options.getUser("discorduser");
      const directZwiftId = interaction.options.getString("zwiftid");
      const searchTerm = interaction.options.getString("searchterm");
      if (directZwiftId) {
        try {
          await db.collection("discord_users").doc(targetUser.id).set({
            discordID: targetUser.id,
            username: targetUser.username,
            zwiftID: directZwiftId,
            linkedAt: admin.firestore.Timestamp.now(),
          });
          const content = `✅ Linked ZwiftID **${directZwiftId}** to ${targetUser.username}.`;
          await ephemeralReplyWithPublish(interaction, content);
        } catch (error) {
          console.error("❌ set_zwiftid Firebase Error:", error);
          await interaction.editReply({ content: "⚠️ Error saving ZwiftID." });
        }
        return;
      }
      if (searchTerm) {
        if (searchTerm.length < 3) {
          await ephemeralReplyWithPublish(interaction, "❌ Please provide at least 3 letters for search!");
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
        const allRiders = docData.data.riders || [];
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
            .setCustomId("setzwift_select_" + targetUser.id)
            .setPlaceholder("Select the rider for " + targetUser.username)
            .addOptions(options)
        );
        await interaction.editReply({
          content: `**Found ${matchingRiders.length} riders** matching "${searchTerm}" for ${targetUser.username}. Select one:`,
          components: [row],
          ephemeral: true
        });
        return;
      }
      await ephemeralReplyWithPublish(interaction, "❌ Provide either `zwiftid:` or `searchterm:` to link for the specified user.");
    }
    // get_zwiftid (retrieve a user's linked ZwiftID)
    else if (commandName === "get_zwiftid") {
      try {
        const targetUser = interaction.options.getUser("discorduser");
        const doc = await db.collection("discord_users").doc(targetUser.id).get();
        if (!doc.exists) {
          await ephemeralReplyWithPublish(interaction, `❌ ${targetUser.username} has not linked a ZwiftID yet.`);
          return;
        }
        const data = doc.data();
        const content = `✅ ${targetUser.username}'s linked ZwiftID: ${data.zwiftID}`;
        await ephemeralReplyWithPublish(interaction, content);
      } catch (error) {
        console.error("❌ get_zwiftid Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching the ZwiftID." });
      }
    }
    // rider_stats
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
          await ephemeralReplyWithPublish(interaction, "❌ Provide a ZwiftID or mention a user who has linked one.");
          return;
        }
        const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
        const rider = response.data;
        if (!rider || !rider.name) {
          await ephemeralReplyWithPublish(interaction, `❌ No data found for ZwiftID **${zwiftID}**.`);
          return;
        }
        const imageBuffer = await generateSingleRiderStatsImage(rider);
        const graphBuffer = await generatePowerLineGraph(rider);
        const graphBuffer2 = await generatePowerLineGraph2(rider);
        const attachment1 = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });
        const attachment2 = new AttachmentBuilder(graphBuffer, { name: "power_graph.png" });
        const attachment3 = new AttachmentBuilder(graphBuffer2, { name: "power_graph2.png" });
        const zwiftPowerLink = `[${rider.name}](<https://www.zwiftpower.com/profile.php?z=${rider.riderId}>)`;
        const content = `ZwiftPower Profile: ${zwiftPowerLink}\n\n`;
        await ephemeralReplyWithPublish(interaction, content, [attachment1, attachment2, attachment3]);
      } catch (error) {
        console.error("❌ rider_stats Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching or generating rider stats." });
      }
    }
    // team_stats
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
        const dateId = new Date().toISOString().split("T")[0];
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
        const graphBuffer = await generatePowerLineGraph(ridersFound);
        const graphBuffer2 = await generatePowerLineGraph2(ridersFound);
        const attachment1 = new AttachmentBuilder(imageBuffer, { name: "team_stats.png" });
        const attachment2 = new AttachmentBuilder(graphBuffer, { name: "power_graph.png" });
        const attachment3 = new AttachmentBuilder(graphBuffer2, { name: "power_graph2.png" });
        const content = `ZwiftPower Profiles: ${zPLinks}\n\n`;
        await ephemeralReplyWithPublish(interaction, content, [attachment1, attachment2, attachment3]);
      } catch (error) {
        console.error("❌ team_stats Error:", error);
        await interaction.editReply({ content: "⚠️ Error generating team stats comparison." });
      }
    }
    // browse_riders
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
    // event_results
    else if (commandName === "event_results") {
      try {
        const searchTerm = interaction.options.getString("search");
        if (!searchTerm || searchTerm.length < 3) {
          await ephemeralReplyWithPublish(interaction, "❌ Please provide at least 3 letters for the search string.");
          return;
        }

        const response = await axios.get(`https://zwiftpower-733125196297.us-central1.run.app/filter_events/11939?title=${encodeURIComponent(searchTerm)}`);
        const data = response.data;

        if (!data.filtered_events || Object.keys(data.filtered_events).length === 0) {
          await ephemeralReplyWithPublish(interaction, `❌ No events found matching "${searchTerm}".`);
          return;
        }

        let content = `# Event Results for "${searchTerm}"\n\n`;
        
        // Sort events by date
        const sortedEvents = Object.entries(data.filtered_events)
          .sort(([, a], [, b]) => new Date(a.event_info.date) - new Date(b.event_info.date));

        for (const [eventId, event] of sortedEvents) {
          content += `## ${event.event_info.title}\n`;
          content += `📅 ${event.event_info.date}\n\n`;
          
          // Create table header with alignment
          content += "| Rider | Cat | Pos | Time | 1m | 5m | 20m |\n";
          content += "|:------|:---:|:---:|:----:|:--:|:--:|:---:|\n";
          
          // Sort riders by category and position
          const sortedRiders = event.riders.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.position_in_cat - b.position_in_cat;
          });

          // Add rider rows with proper spacing
          for (const rider of sortedRiders) {
            const name = rider.name.replace(/\[.*?\]/g, '').trim(); // Remove team tags
            const time = rider.time.padStart(12); // Ensure time is consistently 12 chars wide
            content += `| ${name.padEnd(20)} | ${rider.category.padStart(3)} | ${rider.position_in_cat.toString().padStart(3)} | ${time} | ${rider["1m wkg"].padStart(4)} | ${rider["5m wkg"].padStart(4)} | ${rider["20m wkg"].padStart(4)} |\n`;
          }
          
          content += "\n";
        }

        // Split content if it's too long (Discord has a 2000 character limit)
        const chunks = [];
        while (content.length > 0) {
          if (content.length <= 1900) {
            chunks.push(content);
            break;
          }
          const splitIndex = content.lastIndexOf('\n', 1900);
          chunks.push(content.substring(0, splitIndex));
          content = content.substring(splitIndex + 1);
        }

        // Send each chunk as a separate message
        for (const chunk of chunks) {
          await ephemeralReplyWithPublish(interaction, chunk);
        }

      } catch (error) {
        console.error("❌ event_results Error:", error);
        await interaction.editReply({ content: "⚠️ Error fetching event results." });
      }
    }
  } catch (error) {
    console.error("❌ Unexpected Error:", error);
    if (!interaction.replied) {
      await interaction.reply({ content: "⚠️ An unexpected error occurred!", ephemeral: true });
    }
  }
});

// 10️⃣ Start Bot
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_BOT_TOKEN);
