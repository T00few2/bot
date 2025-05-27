const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("./firebase");

class RoleService {
  constructor() {
    this.collection = "selfRoles";
  }

  // Legacy method - setup single role system (for backward compatibility)
  async setupRoleSystem(guildId, channelId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      let data = doc.exists ? doc.data() : {};
      
      // If this is a legacy setup, convert to new panel structure
      if (!data.panels) {
        data.panels = {};
      }
      
      // Create default panel
      data.panels['default'] = {
        channelId: channelId,
        name: "Server Roles",
        description: "Click the buttons below to add or remove roles!",
        roles: data.roles || [],
        panelMessageId: data.panelMessageId || null,
        requiredRoles: [],
        order: 1,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      // Clean up old structure
      delete data.channelId;
      delete data.roles;
      delete data.panelMessageId;
      
      data.createdAt = data.createdAt || new Date();
      data.updatedAt = new Date();
      
      await docRef.set(data);
      return true;
    } catch (error) {
      console.error("Error setting up role system:", error);
      return false;
    }
  }

  // NEW: Setup a specific role panel
  async setupRolePanel(guildId, panelId, channelId, name, description = null, requiredRoles = []) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      const data = doc.exists ? doc.data() : { panels: {} };
      
      // Initialize panels object if it doesn't exist
      if (!data.panels) {
        data.panels = {};
      }
      
      // Create or update the specific panel
      data.panels[panelId] = {
        channelId: channelId,
        name: name,
        description: description || "Click the buttons below to add or remove roles!",
        roles: data.panels[panelId]?.roles || [],
        panelMessageId: null,
        requiredRoles: requiredRoles,
        order: Object.keys(data.panels).length + 1,
        createdAt: data.panels[panelId]?.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      data.createdAt = data.createdAt || new Date();
      data.updatedAt = new Date();
      
      await docRef.set(data, { merge: true });
      
      return true;
    } catch (error) {
      console.error("Error setting up role panel:", error);
      return false;
    }
  }

  // Legacy method - add role to default panel (for backward compatibility)
  async addSelfRole(guildId, roleId, roleName, description = null, emoji = null) {
    return this.addSelfRoleToPanel(guildId, 'default', roleId, roleName, description, emoji);
  }

  // NEW: Add role to specific panel
  async addSelfRoleToPanel(guildId, panelId, roleId, roleName, description = null, emoji = null) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists || !doc.data().panels || !doc.data().panels[panelId]) {
        throw new Error(`Panel "${panelId}" not found. Use /setup_panel first.`);
      }

      const data = doc.data();
      const panel = data.panels[panelId];
      
      // Check if role already exists in this panel
      if (panel.roles.some(role => role.roleId === roleId)) {
        throw new Error("This role is already in this panel.");
      }

      panel.roles.push({
        roleId,
        roleName,
        description,
        emoji,
        addedAt: new Date()
      });

      panel.updatedAt = new Date();
      data.updatedAt = new Date();

      await docRef.set(data);
      return true;
    } catch (error) {
      console.error("Error adding role to panel:", error);
      throw error;
    }
  }

  // Legacy method - remove role from default panel (for backward compatibility)
  async removeSelfRole(guildId, roleId) {
    return this.removeSelfRoleFromPanel(guildId, 'default', roleId);
  }

  // NEW: Remove role from specific panel
  async removeSelfRoleFromPanel(guildId, panelId, roleId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists || !doc.data().panels || !doc.data().panels[panelId]) {
        throw new Error(`Panel "${panelId}" not found.`);
      }

      const data = doc.data();
      const panel = data.panels[panelId];
      const originalLength = panel.roles.length;
      
      panel.roles = panel.roles.filter(role => role.roleId !== roleId);
      
      if (panel.roles.length === originalLength) {
        throw new Error("This role was not found in this panel.");
      }

      panel.updatedAt = new Date();
      data.updatedAt = new Date();

      await docRef.set(data);
      return true;
    } catch (error) {
      console.error("Error removing role from panel:", error);
      throw error;
    }
  }

  // Legacy method - get default panel config (for backward compatibility)
  async getRoleConfig(guildId) {
    const panels = await this.getAllPanels(guildId);
    if (panels.default) {
      return {
        channelId: panels.default.channelId,
        roles: panels.default.roles,
        panelMessageId: panels.default.panelMessageId,
        createdAt: panels.default.createdAt,
        updatedAt: panels.default.updatedAt
      };
    }
    return null;
  }

  // NEW: Get specific panel configuration
  async getPanelConfig(guildId, panelId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists || !doc.data().panels || !doc.data().panels[panelId]) {
        return null;
      }

      return { ...doc.data().panels[panelId], panelId };
    } catch (error) {
      console.error("Error getting panel config:", error);
      return null;
    }
  }

  // NEW: Get all panels for a guild
  async getAllPanels(guildId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists || !doc.data().panels) {
        return {};
      }

      // Add panelId to each panel object
      const panels = doc.data().panels;
      Object.keys(panels).forEach(panelId => {
        panels[panelId].panelId = panelId;
      });

      return panels;
    } catch (error) {
      console.error("Error getting all panels:", error);
      return {};
    }
  }

  // NEW: Check if user has required roles for a panel
  async canUserAccessPanel(guild, userId, panelConfig) {
    if (!panelConfig.requiredRoles || panelConfig.requiredRoles.length === 0) {
      return { canAccess: true, missingRoles: [] };
    }

    try {
      const member = await guild.members.fetch(userId);
      const missingRoles = [];

      for (const requiredRoleId of panelConfig.requiredRoles) {
        if (!member.roles.cache.has(requiredRoleId)) {
          const role = await guild.roles.fetch(requiredRoleId);
          missingRoles.push(role ? role.name : 'Unknown Role');
        }
      }

      return {
        canAccess: missingRoles.length === 0,
        missingRoles: missingRoles
      };
    } catch (error) {
      console.error("Error checking panel access:", error);
      return { canAccess: false, missingRoles: ['Error checking permissions'] };
    }
  }

  // Legacy method - update panel message ID for default panel
  async updatePanelMessageId(guildId, messageId) {
    return this.updatePanelMessageIdForPanel(guildId, 'default', messageId);
  }

  // NEW: Update panel message ID for specific panel
  async updatePanelMessageIdForPanel(guildId, panelId, messageId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists || !doc.data().panels || !doc.data().panels[panelId]) {
        return false;
      }

      const data = doc.data();
      data.panels[panelId].panelMessageId = messageId;
      data.panels[panelId].updatedAt = new Date();
      data.updatedAt = new Date();

      await docRef.set(data);
      return true;
    } catch (error) {
      console.error("Error updating panel message ID:", error);
      return false;
    }
  }

  // Legacy method - create role panel for default panel
  createRolePanel(roles, guildName) {
    const panelConfig = {
      name: "Role Selection",
      description: "Click the buttons below to add or remove roles!",
      panelId: 'default'
    };
    return this.createRolePanelForPanel(roles, guildName, panelConfig, true);
  }

  // NEW: Create role panel for specific panel with access checks
  createRolePanelForPanel(roles, guildName, panelConfig, userHasAccess = true) {
    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${panelConfig.name}`)
      .setDescription(panelConfig.description || "Click the buttons below to add or remove roles!")
      .setColor(userHasAccess ? 0x5865F2 : 0xFF6B6B)
      .setFooter({ text: `${guildName} • ${panelConfig.name}` })
      .setTimestamp();

    if (!userHasAccess) {
      embed.setDescription("❌ You don't have the required roles to access this panel.");
      return { embeds: [embed], components: [] };
    }

    if (roles.length === 0) {
      embed.setDescription("No roles are currently available in this panel.");
      return { embeds: [embed], components: [] };
    }

    // Add role list to embed
    const roleList = roles.map(role => {
      const emoji = role.emoji || "🔹";
      const description = role.description ? ` - ${role.description}` : "";
      return `${emoji} <@&${role.roleId}>${description}`;
    }).join("\n");

    embed.addFields({ name: "Available Roles", value: roleList });

    // Add required roles info if any
    if (panelConfig.requiredRoles && panelConfig.requiredRoles.length > 0) {
      const requiredRolesList = panelConfig.requiredRoles.map(roleId => `<@&${roleId}>`).join(", ");
      embed.addFields({ 
        name: "🔒 Required Roles", 
        value: `You need: ${requiredRolesList}`,
        inline: false 
      });
    }

    // Create buttons (max 5 per row, max 5 rows = 25 buttons)
    const components = [];
    const maxButtonsPerRow = 5;
    const maxRows = 5;
    const maxButtons = maxButtonsPerRow * maxRows;

    for (let i = 0; i < Math.min(roles.length, maxButtons); i += maxButtonsPerRow) {
      const row = new ActionRowBuilder();
      const rowRoles = roles.slice(i, i + maxButtonsPerRow);

      for (const role of rowRoles) {
        const button = new ButtonBuilder()
          .setCustomId(`role_toggle_${panelConfig.panelId || 'default'}_${role.roleId}`)
          .setLabel(role.roleName)
          .setStyle(ButtonStyle.Secondary);

        if (role.emoji) {
          // Check if it's a custom emoji or unicode
          if (role.emoji.match(/^<:\w+:\d+>$/)) {
            // Custom emoji format
            const emojiMatch = role.emoji.match(/<:\w+:(\d+)>/);
            if (emojiMatch) {
              button.setEmoji(emojiMatch[1]);
            }
          } else {
            // Unicode emoji
            button.setEmoji(role.emoji);
          }
        }

        row.addComponents(button);
      }

      components.push(row);
    }

    return { embeds: [embed], components };
  }

  // Toggle role for a user
  async toggleUserRole(guild, userId, roleId) {
    try {
      const member = await guild.members.fetch(userId);
      const role = await guild.roles.fetch(roleId);

      if (!role) {
        throw new Error("Role not found.");
      }

      // Check if bot can manage this role
      const botMember = await guild.members.fetch(guild.client.user.id);
      if (role.position >= botMember.roles.highest.position) {
        throw new Error("I don't have permission to manage this role. Please ensure my role is higher than the roles I need to manage.");
      }

      const hasRole = member.roles.cache.has(roleId);

      if (hasRole) {
        await member.roles.remove(roleId);
        return { action: "removed", roleName: role.name };
      } else {
        await member.roles.add(roleId);
        return { action: "added", roleName: role.name };
      }
    } catch (error) {
      console.error("Error toggling user role:", error);
      throw error;
    }
  }

  // NEW: Get panel autocomplete options
  async getPanelAutocompleteOptions(guildId) {
    try {
      const panels = await this.getAllPanels(guildId);
      return Object.keys(panels).map(panelId => ({
        name: `${panels[panelId].name} (${panelId})`,
        value: panelId
      }));
    } catch (error) {
      console.error("Error getting panel autocomplete options:", error);
      return [];
    }
  }
}

module.exports = new RoleService(); 