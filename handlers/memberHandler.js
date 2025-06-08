const { EmbedBuilder } = require("discord.js");
const { getWelcomeMessage, processMessageContent } = require("../services/contentApi");
const config = require("../config/config");

/**
 * Handle new member joining the server
 */
async function handleGuildMemberAdd(member) {
  try {
    console.log(`🔔 NEW MEMBER EVENT TRIGGERED: ${member.user.username} (${member.user.id}) joined ${member.guild.name}`);
    
    // Get welcome message from API
    const welcomeMessage = await getWelcomeMessage();
    if (!welcomeMessage) {
      console.log("❌ No welcome message configured");
      return;
    }

    console.log(`✅ Welcome message found: ${welcomeMessage.title}`);

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

    // Send to channel specified in welcome message or fallback to config/system channel
    const channelId = welcomeMessage.channel_id || config.discord.welcomeChannelId || member.guild.systemChannelId;
    if (!channelId) {
      console.log("❌ No welcome channel configured - no channel_id in message, welcomeChannelId, or systemChannelId");
      return;
    }

    console.log(`📍 Attempting to send welcome message to channel: ${channelId}`);

    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      await channel.send(messageOptions);
      console.log(`✅ Successfully sent welcome message to ${member.user.username} in #${channel.name}`);
    } else {
      console.log(`❌ Could not find channel with ID: ${channelId}`);
    }

  } catch (error) {
    console.error("❌ Error sending welcome message:", error);
  }
}

/**
 * Handle member role updates (when roles are added or removed)
 */
async function handleGuildMemberUpdate(oldMember, newMember) {
  try {
    // Check if roles have changed
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    
    // Find added roles
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    
    if (addedRoles.size === 0) {
      return; // No roles were added
    }
    
    console.log(`🔔 ROLE UPDATE EVENT: ${newMember.user.username} received ${addedRoles.size} new role(s)`);
    
    // Process each added role
    for (const [roleId, role] of addedRoles) {
      await handleRoleAssignment(newMember, role);
    }
    
  } catch (error) {
    console.error("❌ Error handling member role update:", error);
  }
}

/**
 * Handle a specific role assignment
 */
async function handleRoleAssignment(member, role) {
  try {
    console.log(`🎭 Processing role assignment: ${member.user.username} received role "${role.name}" (${role.id})`);
    
    // Get role messages from API
    const response = await fetch(`${config.contentApi.baseUrl}/api/messages/role-messages`, {
      headers: {
        'Authorization': `Bearer ${config.contentApi.apiKey}`
      }
    });
    
    if (!response.ok) {
      console.log("❌ Failed to fetch role messages from API");
      return;
    }
    
    const roleMessages = await response.json();
    
    // Find messages for this specific role
    const matchingMessages = roleMessages.filter(msg => 
      msg.active && msg.role_id === role.id
    );
    
    if (matchingMessages.length === 0) {
      console.log(`📭 No role messages configured for role "${role.name}"`);
      return;
    }
    
    console.log(`✅ Found ${matchingMessages.length} role message(s) for role "${role.name}"`);
    
    // Process each matching message
    for (const roleMessage of matchingMessages) {
      await sendRoleMessage(member, role, roleMessage);
    }
    
  } catch (error) {
    console.error("❌ Error handling role assignment:", error);
  }
}

/**
 * Send a role assignment message
 */
async function sendRoleMessage(member, role, roleMessage) {
  try {
    console.log(`📤 Sending role message: "${roleMessage.title}" for role "${role.name}"`);
    
    // Process message content with variables
    const variables = {
      username: member.user.username,
      displayName: member.displayName,
      server_name: member.guild.name,
      member_count: member.guild.memberCount,
      mention: `<@${member.user.id}>`,
      role_name: role.name,
      role_mention: `<@&${role.id}>`,
      role_color: role.hexColor || '#000000'
    };
    
    const { processMessageContent } = require("../services/contentApi");
    const content = processMessageContent(roleMessage.content, variables);
    
    // Build message object
    const messageOptions = { content };
    
    // Send to specified channel
    const channelId = roleMessage.channel_id;
    if (!channelId) {
      console.log("❌ No channel specified for role message");
      return;
    }
    
    console.log(`📍 Attempting to send role message to channel: ${channelId}`);
    
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      await channel.send(messageOptions);
      console.log(`✅ Successfully sent role message for ${member.user.username} receiving "${role.name}" in #${channel.name}`);
    } else {
      console.log(`❌ Could not find channel with ID: ${channelId}`);
    }
    
  } catch (error) {
    console.error("❌ Error sending role message:", error);
  }
}

module.exports = {
  handleGuildMemberAdd,
  handleGuildMemberUpdate,
}; 