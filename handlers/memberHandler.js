const { EmbedBuilder } = require("discord.js");
const { getWelcomeMessage, processMessageContent } = require("../services/contentApi");
const config = require("../config/config");

/**
 * Handle new member joining the server
 */
async function handleGuildMemberAdd(member) {
  try {
    // Get welcome message from API
    const welcomeMessage = await getWelcomeMessage();
    if (!welcomeMessage) {
      console.log("No welcome message configured");
      return;
    }

    // Process message content with member variables
    const variables = {
      username: member.user.username,
      displayName: member.displayName,
      server_name: member.guild.name,
      member_count: member.guild.memberCount,
      mention: `<@${member.user.id}>`
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
        embed.setThumbnail(member.user.displayAvatarURL());
      }

      if (welcomeMessage.embed.footer) {
        embed.setFooter({ 
          text: processMessageContent(welcomeMessage.embed.footer, variables) 
        });
      }

      messageOptions.embeds = [embed];
    }

    // Send to welcome channel or general channel
    const channelId = config.discord.welcomeChannelId || member.guild.systemChannelId;
    if (!channelId) {
      console.log("No welcome channel configured");
      return;
    }

    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      await channel.send(messageOptions);
      console.log(`✅ Sent welcome message to ${member.user.username}`);
    }

  } catch (error) {
    console.error("❌ Error sending welcome message:", error);
  }
}

module.exports = {
  handleGuildMemberAdd,
}; 