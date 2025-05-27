const { ChannelType, EmbedBuilder } = require("discord.js");
const roleService = require("../services/roleService");

// Legacy handlers (for backward compatibility)
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
      await interaction.editReply(`✅ Default role system has been setup for ${channel}!\n\nNext steps:\n1. Use \`/add_selfrole\` to add roles to the selection list\n2. Use \`/roles_panel\` to create the role selection panel\n\n💡 **New**: Try the advanced panel system with \`/setup_panel\` for channel-specific roles!`);
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

    let response = `✅ Added **${role.name}** to the default role panel!`;
    if (description) response += `\nDescription: ${description}`;
    if (emoji) response += `\nEmoji: ${emoji}`;
    response += `\n\nUse \`/roles_panel\` to update the role selection panel.`;
    response += `\n\n💡 **Tip**: Use \`/add_panel_role\` for more advanced panel management!`;

    await interaction.editReply(response);
  } catch (error) {
    console.error("Error in handleAddSelfRole:", error);
    if (error.message.includes("Panel") && error.message.includes("not found")) {
      await interaction.editReply("❌ Default role system not setup for this server. Use `/setup_roles` first.");
    } else if (error.message.includes("already in")) {
      await interaction.editReply("❌ This role is already in the default role panel.");
    } else {
      await interaction.editReply("❌ An error occurred while adding the role.");
    }
  }
}

async function handleRemoveSelfRole(interaction) {
  try {
    const role = interaction.options.getRole("role");

    await roleService.removeSelfRole(interaction.guild.id, role.id);

    await interaction.editReply(`✅ Removed **${role.name}** from the default role panel!\n\nUse \`/roles_panel\` to update the role selection panel.`);
  } catch (error) {
    console.error("Error in handleRemoveSelfRole:", error);
    if (error.message.includes("Panel") && error.message.includes("not found")) {
      await interaction.editReply("❌ Default role system not setup for this server. Use `/setup_roles` first.");
    } else if (error.message.includes("not found")) {
      await interaction.editReply("❌ This role was not found in the default role panel.");
    } else {
      await interaction.editReply("❌ An error occurred while removing the role.");
    }
  }
}

async function handleRolesPanel(interaction) {
  try {
    const config = await roleService.getRoleConfig(interaction.guild.id);
    
    if (!config) {
      await interaction.editReply("❌ Default role system not setup for this server. Use `/setup_roles` first.");
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

    await interaction.editReply(`✅ Default role selection panel has been ${config.panelMessageId ? 'updated' : 'created'} in ${channel}!\n\n💡 **Tip**: Try \`/list_panels\` to see all your role panels!`);
  } catch (error) {
    console.error("Error in handleRolesPanel:", error);
    await interaction.editReply("❌ An error occurred while creating the role panel.");
  }
}

// NEW: Multi-panel handlers
async function handleSetupPanel(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
    const channel = interaction.options.getChannel("channel");
    const name = interaction.options.getString("name");
    const description = interaction.options.getString("description");
    const requiredRole = interaction.options.getRole("required_role");
    
    // Validate panel ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(panelId)) {
      await interaction.editReply("❌ Panel ID can only contain letters, numbers, underscores, and hyphens.");
      return;
    }

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

    const requiredRoles = requiredRole ? [requiredRole.id] : [];
    const success = await roleService.setupRolePanel(
      interaction.guild.id, 
      panelId, 
      channel.id, 
      name, 
      description, 
      requiredRoles
    );
    
    if (success) {
      let response = `✅ Role panel **${name}** (ID: \`${panelId}\`) has been setup for ${channel}!`;
      if (requiredRole) {
        response += `\n🔒 Required role: ${requiredRole}`;
      }
      response += `\n\nNext steps:\n1. Use \`/add_panel_role panel_id:${panelId}\` to add roles\n2. Use \`/update_panel panel_id:${panelId}\` to create the panel`;
      
      await interaction.editReply(response);
    } else {
      await interaction.editReply("❌ Failed to setup the role panel. Please try again.");
    }
  } catch (error) {
    console.error("Error in handleSetupPanel:", error);
    await interaction.editReply("❌ An error occurred while setting up the role panel.");
  }
}

async function handleAddPanelRole(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
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

    await roleService.addSelfRoleToPanel(
      interaction.guild.id,
      panelId,
      role.id,
      role.name,
      description,
      emoji
    );

    let response = `✅ Added **${role.name}** to panel **${panelId}**!`;
    if (description) response += `\nDescription: ${description}`;
    if (emoji) response += `\nEmoji: ${emoji}`;
    response += `\n\nUse \`/update_panel panel_id:${panelId}\` to refresh the panel.`;

    await interaction.editReply(response);
  } catch (error) {
    console.error("Error in handleAddPanelRole:", error);
    if (error.message.includes("not found")) {
      await interaction.editReply(`❌ Panel "${interaction.options.getString("panel_id")}" not found. Use \`/setup_panel\` first.`);
    } else if (error.message.includes("already in")) {
      await interaction.editReply("❌ This role is already in this panel.");
    } else {
      await interaction.editReply("❌ An error occurred while adding the role.");
    }
  }
}

async function handleRemovePanelRole(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
    const role = interaction.options.getRole("role");

    await roleService.removeSelfRoleFromPanel(interaction.guild.id, panelId, role.id);

    await interaction.editReply(`✅ Removed **${role.name}** from panel **${panelId}**!\n\nUse \`/update_panel panel_id:${panelId}\` to refresh the panel.`);
  } catch (error) {
    console.error("Error in handleRemovePanelRole:", error);
    if (error.message.includes("not found") && error.message.includes("Panel")) {
      await interaction.editReply(`❌ Panel "${interaction.options.getString("panel_id")}" not found.`);
    } else if (error.message.includes("not found")) {
      await interaction.editReply("❌ This role was not found in this panel.");
    } else {
      await interaction.editReply("❌ An error occurred while removing the role.");
    }
  }
}

async function handleUpdatePanel(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
    const panelConfig = await roleService.getPanelConfig(interaction.guild.id, panelId);
    
    if (!panelConfig) {
      await interaction.editReply(`❌ Panel "${panelId}" not found.`);
      return;
    }

    const channel = interaction.guild.channels.cache.get(panelConfig.channelId);
    if (!channel) {
      await interaction.editReply("❌ The configured panel channel no longer exists. Please run `/setup_panel` again.");
      return;
    }

    // Check if bot has permissions in the channel
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions.has(["SendMessages", "ViewChannel", "EmbedLinks"])) {
      await interaction.editReply("❌ I don't have permission to send messages in the configured channel. Please ensure I have Send Messages, View Channel, and Embed Links permissions.");
      return;
    }

    const panelData = roleService.createRolePanelForPanel(panelConfig.roles, interaction.guild.name, panelConfig, true);

    // Delete old panel message if it exists
    if (panelConfig.panelMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(panelConfig.panelMessageId);
        await oldMessage.delete();
      } catch (error) {
        console.log("Could not delete old panel message:", error.message);
      }
    }

    // Send new panel
    const panelMessage = await channel.send(panelData);
    
    // Update the stored message ID
    await roleService.updatePanelMessageIdForPanel(interaction.guild.id, panelId, panelMessage.id);

    await interaction.editReply(`✅ Panel **${panelConfig.name}** has been ${panelConfig.panelMessageId ? 'updated' : 'created'} in ${channel}!`);
  } catch (error) {
    console.error("Error in handleUpdatePanel:", error);
    await interaction.editReply("❌ An error occurred while updating the panel.");
  }
}

async function handleListPanels(interaction) {
  try {
    const panels = await roleService.getAllPanels(interaction.guild.id);
    
    if (Object.keys(panels).length === 0) {
      await interaction.editReply("❌ No role panels found for this server.\n\nUse `/setup_panel` to create your first panel!");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎭 Role Panels")
      .setDescription("Here are all the role panels configured for this server:")
      .setColor(0x5865F2)
      .setFooter({ text: `${interaction.guild.name} • Role Panel Management` })
      .setTimestamp();

    for (const [panelId, panel] of Object.entries(panels)) {
      const channel = interaction.guild.channels.cache.get(panel.channelId);
      const channelMention = channel ? channel.toString() : "❌ Channel not found";
      
      let fieldValue = `**Channel:** ${channelMention}\n`;
      fieldValue += `**Roles:** ${panel.roles.length}\n`;
      
      if (panel.requiredRoles && panel.requiredRoles.length > 0) {
        const requiredRolesList = panel.requiredRoles.map(roleId => {
          const role = interaction.guild.roles.cache.get(roleId);
          return role ? role.toString() : "❌ Role not found";
        }).join(", ");
        fieldValue += `**Required:** ${requiredRolesList}\n`;
      }
      
      fieldValue += `**Status:** ${panel.panelMessageId ? "✅ Active" : "⚠️ Not deployed"}`;
      
      embed.addFields({
        name: `${panel.name} (\`${panelId}\`)`,
        value: fieldValue,
        inline: true
      });
    }

    embed.addFields({
      name: "📋 Quick Commands",
      value: "• `/add_panel_role` - Add roles to a panel\n• `/update_panel` - Refresh a panel\n• `/setup_panel` - Create new panel",
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in handleListPanels:", error);
    await interaction.editReply("❌ An error occurred while listing panels.");
  }
}

async function handleRolesHelp(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("🎭 Multi-Panel Role System Guide")
      .setDescription("Learn how to create advanced role panels with progressive access control!")
      .setColor(0x5865F2)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        {
          name: "🌟 What is the Multi-Panel System?",
          value: "Create different role panels in different channels, each with their own access requirements. Users progress through role tiers by getting basic roles first to unlock advanced panels.",
          inline: false
        },
        {
          name: "🚀 Quick Setup Example",
          value: "```\n/setup_panel panel_id:basic channel:#general-roles name:\"Basic Roles\"\n/add_panel_role panel_id:basic role:@Member description:\"Basic access\"\n/update_panel panel_id:basic\n```",
          inline: false
        },
        {
          name: "📋 Step-by-Step Setup Guide",
          value: "**1. Plan Your Structure**\n• Decide what roles you want (Member, VIP, etc.)\n• Choose which channels will host panels\n• Plan the progression (what unlocks what)\n\n**2. Create Channels**\n• #general-roles (everyone can view)\n• #member-zone (only @Member can view)\n• #vip-lounge (only @VIP can view)",
          inline: false
        },
        {
          name: "🔧 Panel Creation Commands",
          value: "**Basic Panel (no requirements):**\n`/setup_panel panel_id:basic channel:#general-roles name:\"Basic Roles\"`\n\n**Advanced Panel (requires role):**\n`/setup_panel panel_id:vip channel:#vip-zone name:\"VIP Roles\" required_role:@Member`",
          inline: false
        },
        {
          name: "➕ Adding Roles to Panels",
          value: "**Add roles with descriptions and emojis:**\n`/add_panel_role panel_id:basic role:@Member description:\"Basic member access\" emoji:👤`\n`/add_panel_role panel_id:vip role:@VIP description:\"VIP access\" emoji:💎`",
          inline: false
        },
        {
          name: "🔄 Deploying Your Panels",
          value: "**After adding roles, deploy the panel:**\n`/update_panel panel_id:basic`\n`/update_panel panel_id:vip`\n\n**View all your panels:**\n`/list_panels`",
          inline: false
        },
        {
          name: "💡 Complete Example Setup",
          value: "```bash\n# Step 1: Basic panel for everyone\n/setup_panel panel_id:basic channel:#roles name:\"Server Roles\"\n/add_panel_role panel_id:basic role:@Member emoji:👤\n/add_panel_role panel_id:basic role:@Gamer emoji:🎮\n/update_panel panel_id:basic\n\n# Step 2: VIP panel (requires Member)\n/setup_panel panel_id:vip channel:#vip-zone name:\"VIP Roles\" required_role:@Member\n/add_panel_role panel_id:vip role:@VIP emoji:💎\n/update_panel panel_id:vip\n```",
          inline: false
        },
        {
          name: "🎯 User Experience Flow",
          value: "1. **Users start in #roles** → Get @Member role\n2. **#vip-zone unlocks** → Now accessible with @Member\n3. **Get @VIP role** → Access exclusive features\n4. **Progressive access** → Each role unlocks new opportunities",
          inline: false
        },
        {
          name: "🛠️ Management Commands",
          value: "`/list_panels` - View all panels and their status\n`/add_panel_role` - Add more roles to existing panels\n`/remove_panel_role` - Remove roles from panels\n`/update_panel` - Refresh a panel after changes",
          inline: false
        },
        {
          name: "⚠️ Important Notes",
          value: "• **Bot role must be higher** than roles it manages\n• **Channel permissions** control who can see panels\n• **Required roles** create the progression system\n• **Panel IDs** must be unique (use: letters, numbers, -, _)",
          inline: false
        },
        {
          name: "🔒 Access Control Tips",
          value: "• Set channel permissions so only certain roles can view advanced channels\n• Use descriptive panel names and IDs\n• Test the progression flow with a test account\n• Start simple and add complexity gradually",
          inline: false
        }
      )
      .setFooter({ 
        text: `${interaction.guild.name} • Multi-Panel Role System`, 
        iconURL: interaction.guild.iconURL() 
      })
      .setTimestamp();

    // Check if any panels are set up for this guild and show current status
    const panels = await roleService.getAllPanels(interaction.guild.id);
    
    if (Object.keys(panels).length > 0) {
      let panelsList = "";
      let totalRoles = 0;
      
      for (const [panelId, panel] of Object.entries(panels)) {
        const channel = interaction.guild.channels.cache.get(panel.channelId);
        const channelMention = channel ? channel.toString() : "❌ Channel not found";
        const status = panel.panelMessageId ? "✅" : "⚠️";
        const requiredInfo = panel.requiredRoles && panel.requiredRoles.length > 0 ? " 🔒" : "";
        
        panelsList += `${status} **${panel.name}** (\`${panelId}\`) - ${panel.roles.length} roles${requiredInfo}\n`;
        totalRoles += panel.roles.length;
      }
      
      embed.addFields({
        name: `📊 Your Current Setup (${Object.keys(panels).length} panels)`,
        value: panelsList.length > 1024 ? panelsList.substring(0, 1021) + "..." : panelsList,
        inline: false
      });
      
      embed.addFields({
        name: "📈 Quick Stats",
        value: `**Total Panels:** ${Object.keys(panels).length}\n**Total Roles:** ${totalRoles}\n**Status:** ✅ Active, ⚠️ Not deployed, 🔒 Has requirements`,
        inline: false
      });
    } else {
      embed.addFields({
        name: "🚀 Ready to Start?",
        value: "No panels found! Use the commands above to create your first multi-panel role system.\n\n**Recommended first step:**\n`/setup_panel panel_id:basic channel:#your-roles-channel name:\"Basic Roles\"`",
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
  // Legacy handlers
  handleSetupRoles,
  handleAddSelfRole,
  handleRemoveSelfRole,
  handleRolesPanel,
  handleRolesHelp,
  // New panel handlers
  handleSetupPanel,
  handleAddPanelRole,
  handleRemovePanelRole,
  handleUpdatePanel,
  handleListPanels,
}; 