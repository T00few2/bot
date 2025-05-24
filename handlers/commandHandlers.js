const axios = require("axios");
const { AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { generatePowerLineGraph, generatePowerLineGraph2 } = require("../utils/powerGraph");
const { generateSingleRiderStatsImage, generateTeamStatsImage, generateEventResultsImage } = require("../utils/imageGenerator");
const { getUserZwiftId, linkUserZwiftId, searchRidersByName, getTodaysClubStats } = require("../services/firebase");
const { ephemeralReplyWithPublish } = require("../utils/ephemeralStore");
const { generatePowerGraph } = require("../utils/powerGraph");
const { getWelcomeMessage, processMessageContent } = require("../services/contentApi");
const { EmbedBuilder } = require("discord.js");
const config = require("../config/config");

async function handleMyZwiftId(interaction) {
  const zwiftID = interaction.options.getString("zwiftid");
  const searchTerm = interaction.options.getString("searchterm");
  const discordID = interaction.user.id;
  const username = interaction.user.username;

  if (zwiftID) {
    try {
      await linkUserZwiftId(discordID, username, zwiftID);
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

    const matchingRiders = await searchRidersByName(searchTerm);
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
      components: [row]
    });
    return;
  }

  await ephemeralReplyWithPublish(interaction, "❌ Provide either `zwiftid:` or `searchterm:` to link.");
}

async function handleSetZwiftId(interaction) {
  const targetUser = interaction.options.getUser("discorduser");
  const directZwiftId = interaction.options.getString("zwiftid");
  const searchTerm = interaction.options.getString("searchterm");

  if (directZwiftId) {
    try {
      await linkUserZwiftId(targetUser.id, targetUser.username, directZwiftId);
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

    const matchingRiders = await searchRidersByName(searchTerm);
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
      components: [row]
    });
    return;
  }

  await ephemeralReplyWithPublish(interaction, "❌ Provide either `zwiftid:` or `searchterm:` to link for the specified user.");
}

async function handleGetZwiftId(interaction) {
  try {
    const targetUser = interaction.options.getUser("discorduser");
    const zwiftId = await getUserZwiftId(targetUser.id);
    
    if (!zwiftId) {
      await ephemeralReplyWithPublish(interaction, `❌ ${targetUser.username} has not linked a ZwiftID yet.`);
      return;
    }

    const content = `✅ ${targetUser.username}'s linked ZwiftID: ${zwiftId}`;
    await ephemeralReplyWithPublish(interaction, content);
  } catch (error) {
    console.error("❌ get_zwiftid Error:", error);
    await interaction.editReply({ content: "⚠️ Error fetching the ZwiftID." });
  }
}

async function handleRiderStats(interaction) {
  try {
    const zwiftIDOption = interaction.options.getString("zwiftid");
    const discordUser = interaction.options.getUser("discorduser");
    let zwiftID = zwiftIDOption;

    if (!zwiftID && discordUser) {
      zwiftID = await getUserZwiftId(discordUser.id);
      if (!zwiftID) {
        await ephemeralReplyWithPublish(interaction, `❌ **${discordUser.username}** has not linked their ZwiftID yet!`);
        return;
      }
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

async function handleTeamStats(interaction) {
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
      const zwiftId = await getUserZwiftId(userObj.id);
      if (!zwiftId) {
        await ephemeralReplyWithPublish(interaction, `❌ **${userObj.username}** has not linked a ZwiftID yet!`);
        return;
      }
      discordToZwiftMap[userObj.id] = zwiftId;
    }

    const allRiders = await getTodaysClubStats();
    if (!allRiders) {
      await ephemeralReplyWithPublish(interaction, "❌ No club_stats found for today!");
      return;
    }

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

async function handleBrowseRiders(interaction) {
  try {
    const searchTerm = interaction.options.getString("searchterm") || "";
    if (searchTerm.length < 3) {
      await ephemeralReplyWithPublish(interaction, "❌ Please provide at least 3 letters.");
      return;
    }

    const matchingRiders = await searchRidersByName(searchTerm);
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
      components: [row]
    });
  } catch (error) {
    console.error("❌ browse_riders Error:", error);
    await interaction.editReply({ content: "⚠️ Error fetching rider list." });
  }
}

async function handleEventResults(interaction) {
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

    const imageBuffer = await generateEventResultsImage(data.filtered_events);
    const attachment = new AttachmentBuilder(imageBuffer, { name: "event_results.png" });
    
    await ephemeralReplyWithPublish(interaction, `Event Results for "${searchTerm}"`, [attachment]);
  } catch (error) {
    console.error("❌ event_results Error:", error);
    await interaction.editReply({ content: "⚠️ Error fetching event results." });
  }
}

async function handleWhoAmI(interaction) {
  try {
    const zwiftId = await getUserZwiftId(interaction.user.id);
    
    if (!zwiftId) {
      await ephemeralReplyWithPublish(interaction, "❌ You haven't linked a ZwiftID yet. Use `/my_zwiftid` to link one.");
      return;
    }

    const content = `✅ Your linked ZwiftID: ${zwiftId}`;
    await ephemeralReplyWithPublish(interaction, content);
  } catch (error) {
    console.error("❌ whoami Error:", error);
    await interaction.editReply({ content: "⚠️ Error fetching your ZwiftID." });
  }
}

async function handleTestWelcome(interaction) {
  try {
    const targetUser = interaction.options.getUser("target_user") || interaction.user;
    
    // Check if user has admin permissions (moved after defer to prevent timeout)
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      await interaction.editReply({ content: "❌ This command is for administrators only." });
      return;
    }
    
    // Get welcome message from API
    const welcomeMessage = await getWelcomeMessage();
    if (!welcomeMessage) {
      await interaction.editReply({ content: "❌ No welcome message configured. Create one via the web interface first." });
      return;
    }

    // Process message content with member variables
    const variables = {
      username: targetUser.username,
      displayName: targetUser.displayName || targetUser.username,
      server_name: interaction.guild.name,
      member_count: interaction.guild.memberCount,
      mention: `<@${targetUser.id}>`
    };

    const content = processMessageContent(welcomeMessage.content, variables);

    // Build message object
    const messageOptions = { content };

    // Add embed if configured
    if (welcomeMessage.embed) {
      const embed = new EmbedBuilder()
        .setTitle(processMessageContent(welcomeMessage.embed.title || "", variables))
        .setDescription(processMessageContent(welcomeMessage.embed.description || "", variables))
        .setColor(welcomeMessage.embed.color || 0x0099FF);

      if (welcomeMessage.embed.thumbnail) {
        embed.setThumbnail(targetUser.displayAvatarURL());
      }

      if (welcomeMessage.embed.footer) {
        embed.setFooter({ 
          text: processMessageContent(welcomeMessage.embed.footer, variables) 
        });
      }

      messageOptions.embeds = [embed];
    }

    // Determine channel to send to
    const channelId = config.discord.welcomeChannelId || interaction.guild.systemChannelId || interaction.channelId;
    const channel = interaction.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await interaction.editReply({ 
        content: "❌ No welcome channel configured. Set DISCORD_WELCOME_CHANNEL_ID in your environment variables." 
      });
      return;
    }

    // Send test welcome message
    await channel.send(messageOptions);
    
    await interaction.editReply({ 
      content: `✅ Test welcome message sent to ${channel} for ${targetUser.username}!\n\n**Preview:**\n${content}` 
    });

  } catch (error) {
    console.error("❌ test_welcome Error:", error);
    await interaction.editReply({ content: "⚠️ Error testing welcome message: " + error.message });
  }
}

module.exports = {
  handleMyZwiftId,
  handleSetZwiftId,
  handleGetZwiftId,
  handleRiderStats,
  handleTeamStats,
  handleBrowseRiders,
  handleEventResults,
  handleWhoAmI,
  handleTestWelcome,
}; 