const { EmbedBuilder } = require("discord.js");
const { getDueScheduledMessages, markScheduledMessageSent, processMessageContent } = require("./contentApi");

/**
 * Check for and send scheduled messages
 */
async function checkScheduledMessages(client) {
  try {
    console.log("🔍 Checking for scheduled messages...");
    const dueMessages = await getDueScheduledMessages();
    
    console.log(`📋 Found ${dueMessages.length} due messages`);
    
    if (dueMessages.length === 0) {
      console.log("✅ No scheduled messages due at this time");
      return;
    }
    
    for (const scheduledMessage of dueMessages) {
      console.log(`📤 Processing scheduled message: ${scheduledMessage.title} (ID: ${scheduledMessage.id})`);
      await sendScheduledMessage(client, scheduledMessage);
    }
  } catch (error) {
    console.error("❌ Error checking scheduled messages:", error);
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