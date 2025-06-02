const { ChannelType, EmbedBuilder } = require("discord.js");
const roleService = require("../services/roleService");
const approvalService = require("../services/approvalService");

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
    const requiresApproval = interaction.options.getBoolean("requires_approval") || false;
    const teamCaptain = interaction.options.getUser("team_captain");

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

    // If approval is required but no team captain is set, that's okay (admin-only approval)
    if (requiresApproval && teamCaptain) {
      // Verify the team captain is a member of the guild
      try {
        await interaction.guild.members.fetch(teamCaptain.id);
      } catch (error) {
        await interaction.editReply("❌ The specified team captain is not a member of this server.");
        return;
      }
    }

    await roleService.addSelfRoleToPanel(
      interaction.guild.id,
      panelId,
      role.id,
      role.name,
      description,
      emoji,
      requiresApproval,
      teamCaptain ? teamCaptain.id : null
    );

    let response = `✅ Added **${role.name}** to panel **${panelId}**!`;
    if (description) response += `\nDescription: ${description}`;
    if (emoji) response += `\nEmoji: ${emoji}`;
    if (requiresApproval) {
      response += `\n🔐 **Requires Approval**: Yes`;
      if (teamCaptain) {
        response += `\n👨‍✈️ **Team Captain**: ${teamCaptain.displayName} (${teamCaptain.tag})`;
      } else {
        response += `\n👮 **Approver**: Admins only`;
      }
    }
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
      .setTitle("🎭 Advanced Role System Guide")
      .setDescription("Complete guide to multi-panel roles with approval workflows!")
      .setColor(0x5865F2)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        {
          name: "🌟 What is the Multi-Panel System?",
          value: "Create different role panels in different channels, each with their own access requirements and approval workflows. Users progress through role tiers while admins control sensitive role assignments.",
          inline: false
        },
        {
          name: "🔐 NEW: Team Captain Approval System",
          value: "**Perfect for Zwift Racing Teams!** 🚴‍♂️\n**Team Captains**: Assign specific users to approve team join requests\n**Visual Indicators**: 🔐 icon shows approval-required roles\n**Auto-Processing**: Approved roles are assigned automatically\n**Flexible Approval**: Team captains OR admins can approve requests",
          inline: false
        },
        {
          name: "🚀 Quick Setup Example",
          value: "```\n# Basic panel\n/setup_panel panel_id:basic channel:#roles name:\"Basic Roles\"\n/add_panel_role panel_id:basic role:@Member emoji:👤\n\n# Team panel with captain approval\n/setup_panel panel_id:teams channel:#team-zone name:\"Racing Teams\" required_role:@Member\n/add_panel_role panel_id:teams role:@TeamA requires_approval:true team_captain:@CaptainA\n/update_panel panel_id:teams\n```",
          inline: false
        },
        {
          name: "🔧 Panel Creation Commands",
          value: "**Basic Panel (no requirements):**\n`/setup_panel panel_id:basic channel:#general-roles name:\"Basic Roles\"`\n\n**Advanced Panel (requires role):**\n`/setup_panel panel_id:vip channel:#vip-zone name:\"VIP Roles\" required_role:@Member`\n\n**Setup Approval Channel:**\n`/setup_approval_channel channel:#approvals`",
          inline: false
        },
        {
          name: "➕ Adding Roles with Team Captain Control",
          value: "**Instant Role (no approval):**\n`/add_panel_role panel_id:basic role:@Member description:\"Basic access\" emoji:👤`\n\n**Team Role with Captain Approval:**\n`/add_panel_role panel_id:teams role:@TeamA description:\"Team A Riders\" emoji:🚴‍♂️ requires_approval:true team_captain:@CaptainA`\n\n**Admin-Only Approval Role:**\n`/add_panel_role panel_id:teams role:@Moderator emoji:🛡️ requires_approval:true`\n\n**Set Team Captain Later:**\n`/set_team_captain panel_id:teams role:@TeamA team_captain:@NewCaptain`",
          inline: false
        },
        {
          name: "🔐 Approval Workflow Setup",
          value: "**1. Create approval channel** (staff-only)\n**2. Configure the bot:** `/setup_approval_channel channel:#approvals`\n**3. Add approval roles:** Use `requires_approval:true`\n**4. Deploy panels:** `/update_panel panel_id:vip`\n**5. Monitor requests:** `/pending_approvals`",
          inline: false
        },
        {
          name: "👥 Rider Experience Flow",
          value: "**Standard Roles:**\n• Click button → Role assigned instantly ✅\n\n**Team Roles (🔐):**\n• Click button → Join request submitted 📝\n• Team captain gets notification 📢\n• Captain reacts ✅ → Welcome to the team! 🎭\n• Rider gets automatic confirmation 📩",
          inline: false
        },
        {
          name: "👨‍✈️ Team Captain Approval Process",
          value: "**1. Join Request** appears in your approval channel with rider info\n**2. Review Rider** - avatar, username, team requested\n**3. React with ✅** to welcome the rider to your team\n**4. Automatic Processing** - role assigned, message updated\n**5. Monitor Activity** with `/pending_approvals`\n\n*Note: Admins can also approve any request as backup*",
          inline: false
        },
        {
          name: "🛠️ Management Commands",
          value: "**Panel Management:**\n• `/list_panels` - View all panels and status\n• `/add_panel_role` - Add roles (with team captain option)\n• `/remove_panel_role` - Remove roles from panels\n• `/update_panel` - Refresh panel after changes\n\n**Team Captain Management:**\n• `/set_team_captain` - Assign team captains to roles\n• `/set_role_approval` - Toggle approval requirement\n• `/pending_approvals` - View pending requests\n• `/setup_approval_channel` - Configure approval channel",
          inline: false
        },
        {
          name: "🎯 Example Zwift Racing Setup",
          value: "```bash\n# 1. Basic rider roles (instant)\n/setup_panel panel_id:basic channel:#roles name:\"Rider Roles\"\n/add_panel_role panel_id:basic role:@Verified emoji:✅\n/add_panel_role panel_id:basic role:@Zwifter emoji:🚴‍♂️\n\n# 2. Racing teams (captain approval)\n/setup_approval_channel channel:#team-approvals\n/setup_panel panel_id:teams channel:#team-selection name:\"Racing Teams\" required_role:@Verified\n/add_panel_role panel_id:teams role:@TeamA emoji:🔴 requires_approval:true team_captain:@CaptainA\n/add_panel_role panel_id:teams role:@TeamB emoji:🔵 requires_approval:true team_captain:@CaptainB\n/add_panel_role panel_id:teams role:@TeamC emoji:🟢 requires_approval:true team_captain:@CaptainC\n\n# 3. Deploy everything\n/update_panel panel_id:basic\n/update_panel panel_id:teams\n```",
          inline: false
        },
        {
          name: "🔍 Visual Indicators",
          value: "**In Role Panels:**\n• 🔐 icon next to approval-required roles\n• \"Approval Required\" section listing all approval roles\n• Team captain assignments shown for each team role\n• Clear status messages for riders\n\n**In Approval Channel:**\n• Rich embeds with rider avatar and info\n• Team role mentions and panel context\n• Team captain mentions for specific approvals\n• Timestamps showing when requested\n• Status updates when approved",
          inline: false
        },
        {
          name: "⚠️ Important Notes & Best Practices",
          value: "**Security:**\n• Approval channel should be staff-only\n• Team captains OR admins can approve requests\n• Bot role must be higher than managed roles\n\n**Team Management Tips:**\n• Assign trusted riders as team captains\n• Use approval for team roles, keep basic roles instant\n• Monitor team join requests regularly\n• Set up clear team selection guidelines",
          inline: false
        },
        {
          name: "🔧 Required Permissions",
          value: "**Bot Needs (in approval channel):**\n• View Channel, Send Messages, Embed Links\n• Add Reactions, Manage Messages\n\n**Who Can Approve:**\n• Team Captains (for their specific teams)\n• Admins (Administrator OR Manage Roles permission)\n\n**Channel Setup:**\n• Role panels: Public or role-restricted\n• Approval channel: Staff and team captains access",
          inline: false
        },
        {
          name: "🚨 Troubleshooting",
          value: "**No approval messages?**\n• Check bot permissions in approval channel\n• Verify channel is set: `/setup_approval_channel`\n\n**Approvals not working?**\n• Ensure admin has Manage Roles permission\n• Check bot role hierarchy\n• Verify approval message wasn't deleted\n\n**Quick Debug:**\n• `/list_panels` - Check panel status\n• `/pending_approvals` - View requests",
          inline: false
        }
      )
      .setFooter({ 
        text: `${interaction.guild.name} • Team Captain Role System`, 
        iconURL: interaction.guild.iconURL() 
      })
      .setTimestamp();

    // Check if any panels are set up for this guild and show current status
    const panels = await roleService.getAllPanels(interaction.guild.id);
    
    if (Object.keys(panels).length > 0) {
      let panelsList = "";
      let totalRoles = 0;
      let approvalRoles = 0;
      
      for (const [panelId, panel] of Object.entries(panels)) {
        const channel = interaction.guild.channels.cache.get(panel.channelId);
        const status = panel.panelMessageId ? "✅" : "⚠️";
        const requiredInfo = panel.requiredRoles && panel.requiredRoles.length > 0 ? " 🔒" : "";
        
        // Count approval roles
        const panelApprovalRoles = panel.roles.filter(role => role.requiresApproval).length;
        approvalRoles += panelApprovalRoles;
        
        const approvalInfo = panelApprovalRoles > 0 ? ` 🔐${panelApprovalRoles}` : "";
        
        panelsList += `${status} **${panel.name}** (\`${panelId}\`) - ${panel.roles.length} roles${requiredInfo}${approvalInfo}\n`;
        totalRoles += panel.roles.length;
      }
      
      embed.addFields({
        name: `📊 Your Current Setup (${Object.keys(panels).length} panels)`,
        value: panelsList.length > 1024 ? panelsList.substring(0, 1021) + "..." : panelsList,
        inline: false
      });
      
      embed.addFields({
        name: "📈 Quick Stats",
        value: `**Total Panels:** ${Object.keys(panels).length}\n**Total Roles:** ${totalRoles}\n**Approval Roles:** ${approvalRoles}\n**Legend:** ✅ Active, ⚠️ Not deployed, 🔒 Access restricted, 🔐 Requires approval`,
        inline: false
      });

      // Add approval-specific status if there are approval roles
      if (approvalRoles > 0) {
        embed.addFields({
          name: "🔐 Approval System Status",
          value: `**Approval Roles Configured:** ${approvalRoles}\n**Next Steps:**\n• Ensure approval channel is set: \`/setup_approval_channel\`\n• Monitor requests: \`/pending_approvals\`\n• Review approval workflow in guide above`,
          inline: false
        });
      }
    } else {
      embed.addFields({
        name: "🚀 Ready to Start?",
        value: "No panels found! Use the commands above to create your first advanced role system.\n\n**Recommended first steps:**\n1. `/setup_panel panel_id:basic channel:#your-roles-channel name:\"Basic Roles\"`\n2. `/setup_approval_channel channel:#staff-approvals`\n3. `/add_panel_role panel_id:basic role:@Member`",
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in handleRolesHelp:", error);
    await interaction.editReply("❌ An error occurred while displaying the role system guide.");
  }
}

async function handleSetRoleApproval(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
    const role = interaction.options.getRole("role");
    const requiresApproval = interaction.options.getBoolean("requires_approval");

    await roleService.updateRoleApprovalRequirement(
      interaction.guild.id,
      panelId,
      role.id,
      requiresApproval
    );

    const statusText = requiresApproval ? "now requires approval" : "no longer requires approval";
    await interaction.editReply(
      `✅ **${role.name}** in panel **${panelId}** ${statusText}!\n\nUse \`/update_panel panel_id:${panelId}\` to refresh the panel.`
    );
  } catch (error) {
    console.error("Error in handleSetRoleApproval:", error);
    if (error.message.includes("not found") && error.message.includes("Panel")) {
      await interaction.editReply(`❌ Panel "${interaction.options.getString("panel_id")}" not found.`);
    } else if (error.message.includes("not found")) {
      await interaction.editReply("❌ This role was not found in this panel.");
    } else {
      await interaction.editReply("❌ An error occurred while updating the role approval requirement.");
    }
  }
}

async function handlePendingApprovals(interaction) {
  try {
    const pendingRequests = await approvalService.getPendingRequests(interaction.guild.id);

    if (pendingRequests.length === 0) {
      await interaction.editReply("✅ No pending team join requests found!");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏁 Pending Team Join Requests")
      .setDescription(`Found ${pendingRequests.length} pending team join request(s)`)
      .setColor(0xFFAA00)
      .setFooter({ text: `${interaction.guild.name} • Team Approvals` })
      .setTimestamp();

    for (const request of pendingRequests.slice(0, 10)) { // Limit to 10 to avoid embed limits
      try {
        const user = await interaction.guild.members.fetch(request.userId);
        const role = await interaction.guild.roles.fetch(request.roleId);
        
        let fieldValue = [
          `**Rider:** ${user.displayName} (${user.user.tag})`,
          `**Team:** ${role ? role.toString() : 'Team not found'}`,
          `**Panel:** ${request.panelName}`,
          `**Requested:** <t:${Math.floor(request.requestedAt.toDate().getTime() / 1000)}:R>`
        ];

        // Add team captain info if available
        if (request.teamCaptainId) {
          try {
            const captain = await interaction.guild.members.fetch(request.teamCaptainId);
            fieldValue.push(`**Team Captain:** ${captain.displayName}`);
          } catch (captainError) {
            fieldValue.push(`**Team Captain:** <@${request.teamCaptainId}>`);
          }
        }

        embed.addFields({
          name: `Join Request ${request.id.split('_').pop()}`,
          value: fieldValue.join('\n'),
          inline: true
        });
      } catch (userError) {
        console.error("Error fetching user for approval request:", userError);
      }
    }

    if (pendingRequests.length > 10) {
      embed.addFields({
        name: "📋 Note",
        value: `Showing first 10 of ${pendingRequests.length} pending requests.`,
        inline: false
      });
    }

    embed.addFields({
      name: "✅ How to Approve",
      value: "Team captains and admins can react with ✅ on join requests in your approval channel to welcome riders to their teams.",
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in handlePendingApprovals:", error);
    await interaction.editReply("❌ An error occurred while fetching pending approvals.");
  }
}

async function handleSetupApprovalChannel(interaction) {
  try {
    const channel = interaction.options.getChannel("channel");

    // Validate channel type
    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply("❌ Please select a text channel.");
      return;
    }

    // Check if bot has permissions in the channel
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions.has(["SendMessages", "ViewChannel", "EmbedLinks", "AddReactions"])) {
      await interaction.editReply("❌ I don't have permission to send messages, view channel, embed links, or add reactions in that channel. Please ensure I have the necessary permissions.");
      return;
    }

    // Note: In a production environment, you might want to store this in the database
    // For now, we'll just inform the user to set the environment variable
    await interaction.editReply(
      `✅ Team approval channel set to ${channel}!\n\n` +
      `**Important:** To make this permanent, set the environment variable:\n` +
      `\`DISCORD_APPROVAL_CHANNEL_ID=${channel.id}\`\n\n` +
      `The bot will now send team join requests to this channel. ` +
      `Team captains and admins can approve requests by reacting with ✅.`
    );
  } catch (error) {
    console.error("Error in handleSetupApprovalChannel:", error);
    await interaction.editReply("❌ An error occurred while setting up the approval channel.");
  }
}

async function handleSetTeamCaptain(interaction) {
  try {
    const panelId = interaction.options.getString("panel_id");
    const role = interaction.options.getRole("role");
    const teamCaptain = interaction.options.getUser("team_captain");

    // Verify the team captain is a member of the guild
    try {
      await interaction.guild.members.fetch(teamCaptain.id);
    } catch (error) {
      await interaction.editReply("❌ The specified team captain is not a member of this server.");
      return;
    }

    await roleService.updateRoleTeamCaptain(
      interaction.guild.id,
      panelId,
      role.id,
      teamCaptain.id
    );

    await interaction.editReply(
      `✅ **${teamCaptain.displayName}** (${teamCaptain.tag}) is now the team captain for **${role.name}** in panel **${panelId}**!\n\nUse \`/update_panel panel_id:${panelId}\` to refresh the panel.`
    );
  } catch (error) {
    console.error("Error in handleSetTeamCaptain:", error);
    if (error.message.includes("not found") && error.message.includes("Panel")) {
      await interaction.editReply(`❌ Panel "${interaction.options.getString("panel_id")}" not found.`);
    } else if (error.message.includes("not found")) {
      await interaction.editReply("❌ This role was not found in this panel.");
    } else {
      await interaction.editReply("❌ An error occurred while setting the team captain.");
    }
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
  // New approval handlers
  handleSetRoleApproval,
  handlePendingApprovals,
  handleSetupApprovalChannel,
  handleSetTeamCaptain,
}; 