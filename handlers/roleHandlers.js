const { ChannelType } = require("discord.js");
const roleService = require("../services/roleService");

async function handleSetupRoles(interaction) {
  try {
    const channel = interaction.options.getChannel("channel");
    
    // Validate channel type
    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply("❌ Please select a text channel.");
      return;
    }

    // Check if bot has permissions in the channel
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions.has(["SendMessages", "ViewChannel", "EmbedLinks"])) {
      await interaction.editReply("❌ I don't have permission to send messages in that channel. Please ensure I have Send Messages, View Channel, and Embed Links permissions.");
      return;
    }

    const success = await roleService.setupRoleSystem(interaction.guild.id, channel.id);
    
    if (success) {
      await interaction.editReply(`✅ Self-role system has been setup for ${channel}!\n\nNext steps:\n1. Use \`/add_selfrole\` to add roles to the selection list\n2. Use \`/roles_panel\` to create the role selection panel`);
    } else {
      await interaction.editReply("❌ Failed to setup the role system. Please try again.");
    }
  } catch (error) {
    console.error("Error in handleSetupRoles:", error);
    await interaction.editReply("❌ An error occurred while setting up the role system.");
  }
}

async function handleAddSelfRole(interaction) {
  try {
    const role = interaction.options.getRole("role");
    const description = interaction.options.getString("description");
    const emoji = interaction.options.getString("emoji");

    // Check if bot can manage this role
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      await interaction.editReply("❌ I cannot manage this role because it's higher than or equal to my highest role. Please move my role above this role in the server settings.");
      return;
    }

    // Check if role is @everyone
    if (role.id === interaction.guild.id) {
      await interaction.editReply("❌ You cannot add the @everyone role to self-selection.");
      return;
    }

    // Check if role is managed (bot roles, integration roles, etc.)
    if (role.managed) {
      await interaction.editReply("❌ This role is managed by an integration and cannot be assigned manually.");
      return;
    }

    await roleService.addSelfRole(
      interaction.guild.id,
      role.id,
      role.name,
      description,
      emoji
    );

    let response = `✅ Added **${role.name}** to the self-role list!`;
    if (description) response += `\nDescription: ${description}`;
    if (emoji) response += `\nEmoji: ${emoji}`;
    response += `\n\nUse \`/roles_panel\` to update the role selection panel.`;

    await interaction.editReply(response);
  } catch (error) {
    console.error("Error in handleAddSelfRole:", error);
    if (error.message.includes("Role system not setup")) {
      await interaction.editReply("❌ Role system not setup for this server. Use `/setup_roles` first.");
    } else if (error.message.includes("already in the self-selection list")) {
      await interaction.editReply("❌ This role is already in the self-selection list.");
    } else {
      await interaction.editReply("❌ An error occurred while adding the role.");
    }
  }
}

async function handleRemoveSelfRole(interaction) {
  try {
    const role = interaction.options.getRole("role");

    await roleService.removeSelfRole(interaction.guild.id, role.id);

    await interaction.editReply(`✅ Removed **${role.name}** from the self-role list!\n\nUse \`/roles_panel\` to update the role selection panel.`);
  } catch (error) {
    console.error("Error in handleRemoveSelfRole:", error);
    if (error.message.includes("Role system not setup")) {
      await interaction.editReply("❌ Role system not setup for this server. Use `/setup_roles` first.");
    } else if (error.message.includes("not found in the self-selection list")) {
      await interaction.editReply("❌ This role was not found in the self-selection list.");
    } else {
      await interaction.editReply("❌ An error occurred while removing the role.");
    }
  }
}

async function handleRolesPanel(interaction) {
  try {
    const config = await roleService.getRoleConfig(interaction.guild.id);
    
    if (!config) {
      await interaction.editReply("❌ Role system not setup for this server. Use `/setup_roles` first.");
      return;
    }

    const channel = interaction.guild.channels.cache.get(config.channelId);
    if (!channel) {
      await interaction.editReply("❌ The configured role channel no longer exists. Please run `/setup_roles` again.");
      return;
    }

    // Check if bot has permissions in the channel
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions.has(["SendMessages", "ViewChannel", "EmbedLinks"])) {
      await interaction.editReply("❌ I don't have permission to send messages in the configured channel. Please ensure I have Send Messages, View Channel, and Embed Links permissions.");
      return;
    }

    const panelData = roleService.createRolePanel(config.roles, interaction.guild.name);

    // Delete old panel message if it exists
    if (config.panelMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(config.panelMessageId);
        await oldMessage.delete();
      } catch (error) {
        console.log("Could not delete old panel message:", error.message);
      }
    }

    // Send new panel
    const panelMessage = await channel.send(panelData);
    
    // Update the stored message ID
    await roleService.updatePanelMessageId(interaction.guild.id, panelMessage.id);

    await interaction.editReply(`✅ Role selection panel has been ${config.panelMessageId ? 'updated' : 'created'} in ${channel}!`);
  } catch (error) {
    console.error("Error in handleRolesPanel:", error);
    await interaction.editReply("❌ An error occurred while creating the role panel.");
  }
}

module.exports = {
  handleSetupRoles,
  handleAddSelfRole,
  handleRemoveSelfRole,
  handleRolesPanel,
}; 