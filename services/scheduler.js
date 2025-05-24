const { EmbedBuilder } = require("discord.js");
const { getDueScheduledMessages, markScheduledMessageSent, processMessageContent } = require("./contentApi");

/**
 * Check for and send scheduled messages
 */
async function checkScheduledMessages(client) {
  try {
    const dueMessages = await getDueScheduledMessages();
    
    for (const scheduledMessage of dueMessages) {
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
    const channel = client.channels.cache.get(scheduledMessage.channel_id);
    if (!channel) {
      console.error(`❌ Channel ${scheduledMessage.channel_id} not found for scheduled message ${scheduledMessage.id}`);
      return;
    }

    // Process message content
    const variables = {
      server_name: channel.guild.name,
      channel_name: channel.name,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };

    const content = processMessageContent(scheduledMessage.content, variables);

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
    }

    // Send the message
    await channel.send(messageOptions);
    
    // Mark as sent
    await markScheduledMessageSent(scheduledMessage.id);
    
    console.log(`✅ Sent scheduled message: ${scheduledMessage.title}`);

  } catch (error) {
    console.error("❌ Error sending scheduled message:", error);
  }
}

/**
 * Start the scheduler (runs every minute)
 */
function startScheduler(client) {
  // Check immediately
  checkScheduledMessages(client);
  
  // Then check every minute
  setInterval(() => {
    checkScheduledMessages(client);
  }, 60000); // 1 minute
  
  console.log("✅ Message scheduler started");
}

module.exports = {
  startScheduler,
  checkScheduledMessages,
}; 