const { ChannelType, EmbedBuilder } = require("discord.js");
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

async function handleRolesHelp(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("🎭 Self-Role System Guide")
      .setDescription("Learn how to use the self-role system!")
      .setColor(0x5865F2)
      .setThumbnail("https://cdn.discordapp.com/emojis/🎭.png")
      .addFields(
        {
          name: "📋 What is the Self-Role System?",
          value: "The self-role system allows you to assign and remove roles yourself using interactive buttons in a dedicated channel.",
          inline: false
        },
        {
          name: "🎯 How to Use It",
          value: "1. **Find the Role Panel** - Look for the role selection message in the designated channel\n2. **Click Buttons** - Click any role button to add or remove that role\n3. **Get Feedback** - You'll receive a confirmation message for each action",
          inline: false
        },
        {
          name: "✨ Features",
          value: "• **Toggle Roles** - Click once to add, click again to remove\n• **Instant Feedback** - Get confirmation messages\n• **Visual Interface** - Beautiful embeds with role descriptions\n• **Safe & Secure** - Only manage approved roles",
          inline: false
        },
        {
          name: "🔧 Admin Commands",
          value: "`/setup_roles` - Initialize the system\n`/add_selfrole` - Add a role to selection\n`/remove_selfrole` - Remove a role\n`/roles_panel` - Create/update the panel\n`/roles_help` - Show this guide",
          inline: false
        },
        {
          name: "❓ Need Help?",
          value: "If you can't find the role panel or have issues:\n• Ask an administrator to run `/roles_panel`\n• Check if the role system is set up with `/setup_roles`\n• Make sure you have permission to view the role channel",
          inline: false
        },
        {
          name: "🛡️ Permissions",
          value: "The bot can only manage roles that:\n• Are not managed by other bots\n• Are lower than the bot's highest role\n• Have been specifically added by administrators",
          inline: false
        }
      )
      .setFooter({ 
        text: `${interaction.guild.name} • Self-Role System`, 
        iconURL: interaction.guild.iconURL() 
      })
      .setTimestamp();

    // Check if role system is set up for this guild
    const config = await roleService.getRoleConfig(interaction.guild.id);
    
    if (config && config.channelId) {
      const channel = interaction.guild.channels.cache.get(config.channelId);
      if (channel) {
        embed.addFields({
          name: "📍 Role Channel",
          value: `The role selection panel is located in ${channel}`,
          inline: false
        });
      }
      
      if (config.roles && config.roles.length > 0) {
        const roleList = config.roles.map(role => {
          const emoji = role.emoji || "🔹";
          return `${emoji} **${role.roleName}**${role.description ? ` - ${role.description}` : ''}`;
        }).join('\n');
        
        embed.addFields({
          name: `🎭 Available Roles (${config.roles.length})`,
          value: roleList.length > 1024 ? roleList.substring(0, 1021) + "..." : roleList,
          inline: false
        });
      }
    } else {
      embed.addFields({
        name: "⚠️ System Status",
        value: "The self-role system is not set up for this server yet. Ask an administrator to run `/setup_roles` to get started!",
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in handleRolesHelp:", error);
    await interaction.editReply("❌ An error occurred while displaying the role system guide.");
  }
}

module.exports = {
  handleSetupRoles,
  handleAddSelfRole,
  handleRemoveSelfRole,
  handleRolesPanel,
  handleRolesHelp,
}; 