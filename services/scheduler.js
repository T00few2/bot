const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getDueScheduledMessages, getProbabilitySelectedMessages, markScheduledMessageSent, processMessageContent } = require("./contentApi");
const { sweepGuildForNewMembers } = require("./newMemberService");
const config = require("../config/config");
const { getBotState, setBotState } = require("./firebase");

/**
 * Check for and send scheduled messages (both time-based and probability-based)
 */
async function checkScheduledMessages(client) {
  try {
    console.log("🔍 Checking for scheduled messages...");
    
    // Check time-based scheduled messages
    await checkTimeBasedMessages(client);
    
    // Check probability-based messages (only once per day)
    await checkProbabilityBasedMessages(client);
    
    // Sweep New Member role assignments once per hour
    await checkNewMemberSweeps(client);
    // Update KMS status message periodically
    await updateKmsStatus(client);
    
  } catch (error) {
    console.error("❌ Error checking scheduled messages:", error);
  }
}

/**
 * Check for time-based scheduled messages (existing functionality)
 */
async function checkTimeBasedMessages(client) {
  try {
    console.log("🕐 Checking time-based scheduled messages...");
    const dueMessages = await getDueScheduledMessages();
    
    console.log(`📋 Found ${dueMessages.length} due time-based messages`);
    
    if (dueMessages.length === 0) {
      console.log("✅ No time-based scheduled messages due at this time");
      return;
    }
    
    for (const scheduledMessage of dueMessages) {
      console.log(`📤 Processing time-based scheduled message: ${scheduledMessage.title} (ID: ${scheduledMessage.id})`);
      await sendScheduledMessage(client, scheduledMessage);
    }
  } catch (error) {
    console.error("❌ Error checking time-based scheduled messages:", error);
  }
}

let lastNewMemberSweepHour = null;
async function checkNewMemberSweeps(client) {
  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    if (currentHour === lastNewMemberSweepHour) return; // once per hour
    lastNewMemberSweepHour = currentHour;

    for (const guild of client.guilds.cache.values()) {
      await sweepGuildForNewMembers(guild);
    }
  } catch (error) {
    console.error("❌ Error running New Member sweep:", error);
  }
}

// KMS status updater (countdown + signup count)
async function updateKmsStatus(client) {
  try {
    const channelId = config.kms?.channelId || process.env.KMS_CHANNEL_ID || "1413820948536365190";
    const roleId = config.kms?.roleId || process.env.KMS_ROLE_ID || "1413793742808416377";
    const eventIso = config.kms?.eventIso || process.env.KMS_EVENT_ISO; // e.g., 2025-10-28T18:30:00Z

    if (!channelId || !roleId) return; // Not configured

    const now = new Date();

    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.guild) return;

    // Ensure member cache is populated for accurate role counts
    await channel.guild.members.fetch();

    // Count members with the KMS role
    const role = channel.guild.roles.cache.get(roleId) || await channel.guild.roles.fetch(roleId).catch(() => null);
    let signupCount = 0;
    if (role) {
      signupCount = role.members.size;
    } else {
      // Fallback: compute from member cache if role fetch failed
      signupCount = channel.guild.members.cache.filter(m => m.roles.cache.has(roleId)).size;
    }

    // Build countdown
    let countdownLine = "";
    if (eventIso) {
      const eventDate = new Date(eventIso);
      const diffMs = eventDate.getTime() - now.getTime();
      const absMs = Math.abs(diffMs);
      const days = Math.floor(absMs / (24 * 3600 * 1000));
      const hours = Math.floor((absMs % (24 * 3600 * 1000)) / (3600 * 1000));
      const minutes = Math.floor((absMs % (3600 * 1000)) / (60 * 1000));
      const prefix = diffMs >= 0 ? "⏳ Countdown" : "✅ Event started";
      const human = `${days}d ${hours}t ${minutes}m`;
      countdownLine = `${prefix}: ${human}`;
    }

    const contentLines = [
      "🏆 DZR Klubmesterskab - tirsdag 28. oktober 19:30🏆",
      countdownLine,
      `📝 Signups: ${signupCount}`,
      "Se tilmeldte: [link](<https://www.dzrracingseries.com/members-zone/klubmesterskab>)",
      "Tilmeld/afmeld dig her:",
    ].filter(Boolean);
    const content = contentLines.join("\n");

    // Build signup toggle button (single button)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`kms_toggle_role_${roleId}`)
        .setLabel("Tilmeld/afmeld")
        .setStyle(ButtonStyle.Primary)
    );

    // No extra embeds needed; show masked link in content

    // Retrieve existing status message ID
    const stateKey = `kms_status_${channel.guild.id}_${channel.id}`;
    const existing = await getBotState(stateKey);
    let messageId = existing?.messageId;

    try {
      if (messageId) {
        const msg = await channel.messages.fetch(messageId);
        await msg.edit({ content, components: [row1] });
      } else {
        const sent = await channel.send({ content, components: [row1] });
        messageId = sent.id;
        await setBotState(stateKey, { messageId });
      }
    } catch (e) {
      // If edit failed (deleted?), send a new message
      try {
        const sent = await channel.send({ content, components: [row1] });
        messageId = sent.id;
        await setBotState(stateKey, { messageId });
      } catch (sendErr) {
        console.error("❌ Failed to send KMS status message:", sendErr.message);
      }
    }
  } catch (error) {
    console.error("❌ Error updating KMS status:", error);
  }
}

/**
 * Check for probability-based messages (once per day)
 */
async function checkProbabilityBasedMessages(client) {
  try {
    // Get current time in Central European Time
    const now = new Date();
    const cetTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
    const currentHour = cetTime.getHours();
    const currentMinute = cetTime.getMinutes();
    
    // Check probability messages at 2:00 PM CET
    const PROBABILITY_CHECK_HOUR = 16;
    const PROBABILITY_CHECK_MINUTE = 30;
    
    // Only run during the specific minute to avoid multiple checks
    if (currentHour === PROBABILITY_CHECK_HOUR && currentMinute === PROBABILITY_CHECK_MINUTE) {
      console.log("🎲 Checking probability-based scheduled messages... (CET)");
      const selectedMessages = await getProbabilitySelectedMessages();
      
      console.log(`📋 Found ${selectedMessages.length} probability-selected messages`);
      
      if (selectedMessages.length === 0) {
        console.log("✅ No probability-based messages selected for today");
        return;
      }
      
      for (const scheduledMessage of selectedMessages) {
        console.log(`📤 Processing probability-selected message: ${scheduledMessage.title} (ID: ${scheduledMessage.id})`);
        await sendScheduledMessage(client, scheduledMessage);
      }
    } else {
      // Log only once per hour to avoid spam
      if (currentMinute === 0) {
        console.log(`🎲 Probability check scheduled for ${PROBABILITY_CHECK_HOUR}:${PROBABILITY_CHECK_MINUTE.toString().padStart(2, '0')} CET (current CET: ${currentHour}:${currentMinute.toString().padStart(2, '0')})`);
      }
    }
  } catch (error) {
    console.error("❌ Error checking probability-based scheduled messages:", error);
  }
}

/**
 * Send a scheduled message
 */
async function sendScheduledMessage(client, scheduledMessage) {
  try {
    console.log(`🎯 Attempting to send message "${scheduledMessage.title}" to channel ${scheduledMessage.channel_id}`);
    
    const channel = client.channels.cache.get(scheduledMessage.channel_id);
    if (!channel) {
      console.error(`❌ Channel ${scheduledMessage.channel_id} not found for scheduled message ${scheduledMessage.id}`);
      return;
    }

    console.log(`✅ Found channel: #${channel.name} in ${channel.guild.name}`);

    // Process message content
    const variables = {
      server_name: channel.guild.name,
      channel_name: channel.name,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };

    const content = processMessageContent(scheduledMessage.content, variables);
    console.log(`📝 Processed message content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);

    // Build message object
    const messageOptions = { content };

    // Add embed if configured
    if (scheduledMessage.embed) {
      const embed = new EmbedBuilder()
        .setTitle(processMessageContent(scheduledMessage.embed.title || "", variables))
        .setDescription(processMessageContent(scheduledMessage.embed.description || "", variables))
        .setColor(scheduledMessage.embed.color || 0x0099FF);

      if (scheduledMessage.embed.footer) {
        embed.setFooter({ 
          text: processMessageContent(scheduledMessage.embed.footer, variables) 
        });
      }

      messageOptions.embeds = [embed];
      console.log(`🎨 Added embed to message`);
    }

    // Send the message
    console.log(`🚀 Sending message to Discord...`);
    await channel.send(messageOptions);
    console.log(`✅ Message sent successfully to #${channel.name}`);
    
    // Mark as sent
    console.log(`📋 Marking message ${scheduledMessage.id} as sent...`);
    await markScheduledMessageSent(scheduledMessage.id);
    console.log(`✅ Message ${scheduledMessage.id} marked as sent`);
    
    console.log(`🎉 Completed scheduled message: ${scheduledMessage.title}`);

  } catch (error) {
    console.error(`❌ Error sending scheduled message "${scheduledMessage.title}":`, error);
    console.error(`   Message ID: ${scheduledMessage.id}`);
    console.error(`   Channel ID: ${scheduledMessage.channel_id}`);
  }
}

/**
 * Start the scheduler (runs every minute)
 */
function startScheduler(client) {
  console.log("🚀 Starting message scheduler...");
  
  // Check immediately
  checkScheduledMessages(client);
  
  // Then check every minute
  setInterval(() => {
    checkScheduledMessages(client);
  }, 60000); // 1 minute
  
  console.log("✅ Message scheduler started - checking every minute");
}

module.exports = {
  startScheduler,
  checkScheduledMessages,
}; 