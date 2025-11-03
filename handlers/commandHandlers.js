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
const { checkVerificationAfterZwiftLink } = require("./memberHandler");
const { MessageFlags } = require("discord.js");
const { postSignupBoard, repostSignupBoard } = require("../services/signupService");

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
      
      // Check verification status after linking ZwiftID
      await checkVerificationAfterZwiftLink(interaction.guild, discordID);
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
      
      // Check verification status after linking ZwiftID
      await checkVerificationAfterZwiftLink(interaction.guild, targetUser.id);
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
        const message = `❌ **${discordUser.username}** has not linked their ZwiftID yet!`;
        await ephemeralReplyWithPublish(interaction, message);
        return { success: false, message };
      }
    }

    if (!zwiftID) {
      const message = "❌ Provide a ZwiftID or mention a user who has linked one.";
      await ephemeralReplyWithPublish(interaction, message);
      return { success: false, message };
    }

    const response = await axios.get(`https://www.dzrracingseries.com/api/zr/rider/${zwiftID}`);
    const rider = response.data;

    if (!rider || !rider.name) {
      const message = `❌ No data found for ZwiftID **${zwiftID}**.`;
      await ephemeralReplyWithPublish(interaction, message);
      return { success: false, message };
    }

    const toNumber = (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const computeWkg = (watts, weight) => {
      const wattsNum = toNumber(watts);
      const weightNum = toNumber(weight);
      if (wattsNum === null || weightNum === null || weightNum === 0) return null;
      return wattsNum / weightNum;
    };

    const riderSummary = {
      name: rider?.name ?? null,
      zwiftId: rider?.riderId ?? null,
      paceGroup: rider?.zpCategory ?? null,
      phenotype: rider?.phenotype?.value ?? null,
      velo: {
        category: rider?.race?.current?.mixed?.category ?? null,
        rating: toNumber(rider?.race?.current?.rating)
      },
      ftp: {
        watts: toNumber(rider?.zpFTP),
        wkg: computeWkg(rider?.zpFTP, rider?.weight)
      },
      power: {
        w30: {
          watts: toNumber(rider?.power?.w30),
          wkg: toNumber(rider?.power?.wkg30)
        },
        w60: {
          watts: toNumber(rider?.power?.w60),
          wkg: toNumber(rider?.power?.wkg60)
        },
        w300: {
          watts: toNumber(rider?.power?.w300),
          wkg: toNumber(rider?.power?.wkg300)
        },
        w1200: {
          watts: toNumber(rider?.power?.w1200),
          wkg: toNumber(rider?.power?.wkg1200)
        }
      },
      race: {
        finishes: toNumber(rider?.race?.finishes),
        wins: toNumber(rider?.race?.wins),
        podiums: toNumber(rider?.race?.podiums),
        dnfs: toNumber(rider?.race?.dnfs)
      }
    };

    const imageBuffer = await generateSingleRiderStatsImage(rider);
    const graphBuffer = await generatePowerLineGraph(rider);
    const graphBuffer2 = await generatePowerLineGraph2(rider);

    const attachment1 = new AttachmentBuilder(imageBuffer, { name: "rider_stats.png" });
    const attachment2 = new AttachmentBuilder(graphBuffer, { name: "power_graph.png" });
    const attachment3 = new AttachmentBuilder(graphBuffer2, { name: "power_graph2.png" });

    const zwiftPowerLink = `[${rider.name}](<https://www.zwiftpower.com/profile.php?z=${rider.riderId}>)`;
    const content = `ZwiftPower Profile: ${zwiftPowerLink}`;

    await ephemeralReplyWithPublish(interaction, content, [attachment1, attachment2, attachment3]);
    return {
      success: true,
      rider: riderSummary,
      metadata: {
        zwiftPowerUrl: `https://www.zwiftpower.com/profile.php?z=${rider.riderId}`
      }
    };
  } catch (error) {
    console.error("❌ rider_stats Error:", error);
    await interaction.editReply({ content: "⚠️ Error fetching or generating rider stats." });
    return {
      success: false,
      message: "Error fetching or generating rider stats.",
      error: error?.message
    };
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

    // Build structured team summary for AI commentary
    const toNumber = (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const computeWkg = (watts, weight) => {
      const wattsNum = toNumber(watts);
      const weightNum = toNumber(weight);
      if (wattsNum === null || weightNum === null || weightNum === 0) return null;
      return wattsNum / weightNum;
    };

    const teamSummary = ridersFound.map(r => ({
      name: r?.name ?? null,
      zwiftId: r?.riderId ?? null,
      paceGroup: r?.zpCategory ?? null,
      phenotype: r?.phenotype?.value ?? null,
      velo: {
        category: r?.race?.current?.mixed?.category ?? null,
        rating: toNumber(r?.race?.current?.rating)
      },
      ftp: {
        watts: toNumber(r?.zpFTP),
        wkg: computeWkg(r?.zpFTP, r?.weight)
      },
      power: {
        w30: { watts: toNumber(r?.power?.w30), wkg: toNumber(r?.power?.wkg30) },
        w60: { watts: toNumber(r?.power?.w60), wkg: toNumber(r?.power?.wkg60) },
        w300: { watts: toNumber(r?.power?.w300), wkg: toNumber(r?.power?.wkg300) },
        w1200: { watts: toNumber(r?.power?.w1200), wkg: toNumber(r?.power?.wkg1200) }
      },
      race: {
        finishes: toNumber(r?.race?.finishes),
        wins: toNumber(r?.race?.wins),
        podiums: toNumber(r?.race?.podiums),
        dnfs: toNumber(r?.race?.dnfs)
      }
    }));

    const imageBuffer = await generateTeamStatsImage(ridersFound);
    const graphBuffer = await generatePowerLineGraph(ridersFound);
    const graphBuffer2 = await generatePowerLineGraph2(ridersFound);

    const attachment1 = new AttachmentBuilder(imageBuffer, { name: "team_stats.png" });
    const attachment2 = new AttachmentBuilder(graphBuffer, { name: "power_graph.png" });
    const attachment3 = new AttachmentBuilder(graphBuffer2, { name: "power_graph2.png" });

    const content = `ZwiftPower Profiles: ${zPLinks}\n\n`;
    await ephemeralReplyWithPublish(interaction, content, [attachment1, attachment2, attachment3]);
    return {
      success: true,
      team: teamSummary
    };
  } catch (error) {
    console.error("❌ team_stats Error:", error);
    await interaction.editReply({ content: "⚠️ Error generating team stats comparison." });
    return { success: false, message: "Error generating team stats comparison.", error: error?.message };
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
        .setColor(welcomeMessage.embed.color || 0x0099FF);

      let hasContent = false;

      // Only set title if it's not empty after processing
      const embedTitle = processMessageContent(welcomeMessage.embed.title || "", variables);
      if (embedTitle && embedTitle.trim().length > 0) {
        embed.setTitle(embedTitle);
        hasContent = true;
      }

      // Only set description if it's not empty after processing
      const embedDescription = processMessageContent(welcomeMessage.embed.description || "", variables);
      if (embedDescription && embedDescription.trim().length > 0) {
        embed.setDescription(embedDescription);
        hasContent = true;
      }

      if (welcomeMessage.embed.thumbnail) {
        embed.setThumbnail(targetUser.displayAvatarURL());
        hasContent = true;
      }

      if (welcomeMessage.embed.footer) {
        const footerText = processMessageContent(welcomeMessage.embed.footer, variables);
        if (footerText && footerText.trim().length > 0) {
          embed.setFooter({ text: footerText });
          hasContent = true;
        }
      }

      // Only add embed if it has some content, and ensure it has at least a description
      if (hasContent) {
        // If embed has content but no description, add a minimal one
        if (!embedDescription || embedDescription.trim().length === 0) {
          embed.setDescription(`Welcome ${targetUser.username}!`);
        }
        messageOptions.embeds = [embed];
      }
    }

    // Send test message to current channel (where command was executed)
    const testChannel = interaction.channel;
    
    if (!testChannel) {
      await interaction.editReply({ 
        content: "❌ Could not determine current channel for test message." 
      });
      return;
    }

    // Add a header to distinguish this as a test message
    const testMessageOptions = {
      content: `🧪 **TEST WELCOME MESSAGE** (for ${targetUser.username})\n\n${content}`,
      embeds: messageOptions.embeds
    };

    // Send test welcome message to current channel
    await testChannel.send(testMessageOptions);
    
    // Get info about the real welcome channel for comparison
    const realWelcomeChannelId = config.discord.welcomeChannelId || interaction.guild.systemChannelId;
    const realWelcomeChannel = realWelcomeChannelId ? interaction.guild.channels.cache.get(realWelcomeChannelId) : null;
    const welcomeChannelInfo = realWelcomeChannel ? `#${realWelcomeChannel.name}` : "system channel or first available channel";
    
    await interaction.editReply({ 
      content: `✅ Test welcome message sent to this channel!\n\n📍 **Note:** Real welcome messages will be sent to ${welcomeChannelInfo} when new members join.` 
    });

  } catch (error) {
    console.error("❌ test_welcome Error:", error);
    await interaction.editReply({ content: "⚠️ Error testing welcome message: " + error.message });
  }
}

async function handlePostSignupBoard(interaction) {
  try {
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.editReply({ content: "❌ This command is for administrators only." });
      return;
    }
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    if (!channel || channel.type !== 0 && channel.type !== 5 && channel.type !== 15) { // GuildText, Announcement, Forum ignored
      await interaction.editReply({ content: "❌ Please specify a text channel." });
      return;
    }
    const { message } = await postSignupBoard(channel);
    await interaction.editReply({ content: `✅ Signup board posted in <#${channel.id}> (message ${message.id}).` });
  } catch (error) {
    console.error("❌ post_signup_board Error:", error);
    await interaction.editReply({ content: "⚠️ Error posting signup board: " + (error.message || "Unknown error") });
  }
}

async function handleRepostSignupBoard(interaction) {
  try {
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.editReply({ content: "❌ This command is for administrators only." });
      return;
    }
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    if (!channel || channel.type !== 0 && channel.type !== 5 && channel.type !== 15) {
      await interaction.editReply({ content: "❌ Please specify a text channel." });
      return;
    }
    const { message } = await repostSignupBoard(channel);
    await interaction.editReply({ content: `✅ Signup board reposted in <#${channel.id}> (message ${message.id}).` });
  } catch (error) {
    console.error("❌ repost_signup_board Error:", error);
    await interaction.editReply({ content: "⚠️ Error reposting signup board: " + (error.message || "Unknown error") });
  }
}

/**
 * /new_members
 * Mention members who joined within N days and currently have a specified role
 */
async function handleNewMembers(interaction) {
  try {
    // Admin-only guard
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.editReply({ content: "❌ This command is for administrators only." });
      return;
    }

    const withinDays = interaction.options.getInteger("within_days") ?? 7;
    const role = interaction.options.getRole("role");

    // Ensure we have member cache
    await interaction.guild.members.fetch();

    const now = Date.now();
    const threshold = now - withinDays * 24 * 60 * 60 * 1000;

    // Filter: joined within window AND has specified role
    const matching = interaction.guild.members.cache.filter(m => {
      const joinedTs = m.joinedTimestamp ?? 0;
      return joinedTs >= threshold && m.roles.cache.has(role.id);
    });

    if (matching.size === 0) {
      await interaction.editReply({ content: `ℹ️ No members joined in the last ${withinDays} day(s) with role ${role}.` });
      return;
    }

    // Build mention message in chunks under 2000 chars
    const header = `👋 New members (last ${withinDays} day(s)) with ${role} (${matching.size}):`;
    const mentions = matching.map(m => `<@${m.id}>`).join(" ");

    const messages = [];
    let current = header;
    for (const mention of mentions.split(" ")) {
      if ((current + " " + mention).length > 1900) {
        messages.push(current);
        current = mention;
      } else {
        current = current.length === 0 ? mention : current + " " + mention;
      }
    }
    if (current.length > 0) messages.push(current);

    // Send first chunk via ephemeral with publish button; follow with additional chunks
    await ephemeralReplyWithPublish(interaction, messages[0]);
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ content: messages[i], flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error("❌ new_members Error:", error);
    await interaction.editReply({ content: "⚠️ Error generating new members list." });
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
  handleNewMembers,
  handlePostSignupBoard,
  handleRepostSignupBoard,
}; 