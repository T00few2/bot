const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("./firebase");

class RoleService {
  constructor() {
    this.collection = "selfRoles";
  }

  // Setup self-role system for a guild
  async setupRoleSystem(guildId, channelId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      await docRef.set({
        channelId: channelId,
        roles: [],
        panelMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error("Error setting up role system:", error);
      return false;
    }
  }

  // Add a role to the self-selection list
  async addSelfRole(guildId, roleId, roleName, description = null, emoji = null) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error("Role system not setup for this guild. Use /setup_roles first.");
      }

      const data = doc.data();
      const roles = data.roles || [];
      
      // Check if role already exists
      if (roles.some(role => role.roleId === roleId)) {
        throw new Error("This role is already in the self-selection list.");
      }

      roles.push({
        roleId,
        roleName,
        description,
        emoji,
        addedAt: new Date()
      });

      await docRef.update({
        roles,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error("Error adding self role:", error);
      throw error;
    }
  }

  // Remove a role from the self-selection list
  async removeSelfRole(guildId, roleId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error("Role system not setup for this guild.");
      }

      const data = doc.data();
      const roles = data.roles || [];
      
      const updatedRoles = roles.filter(role => role.roleId !== roleId);
      
      if (updatedRoles.length === roles.length) {
        throw new Error("This role was not found in the self-selection list.");
      }

      await docRef.update({
        roles: updatedRoles,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error("Error removing self role:", error);
      throw error;
    }
  }

  // Get role configuration for a guild
  async getRoleConfig(guildId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error("Error getting role config:", error);
      return null;
    }
  }

  // Update panel message ID
  async updatePanelMessageId(guildId, messageId) {
    try {
      const docRef = db.collection(this.collection).doc(guildId);
      await docRef.update({
        panelMessageId: messageId,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error("Error updating panel message ID:", error);
      return false;
    }
  }

  // Create role selection embed and buttons
  createRolePanel(roles, guildName) {
    const embed = new EmbedBuilder()
      .setTitle("🎭 Role Selection")
      .setDescription("Click the buttons below to add or remove roles!")
      .setColor(0x5865F2)
      .setFooter({ text: `${guildName} • Self-Role System` })
      .setTimestamp();

    if (roles.length === 0) {
      embed.setDescription("No roles are currently available for self-selection.");
      return { embeds: [embed], components: [] };
    }

    // Add role list to embed
    const roleList = roles.map(role => {
      const emoji = role.emoji || "🔹";
      const description = role.description ? ` - ${role.description}` : "";
      return `${emoji} <@&${role.roleId}>${description}`;
    }).join("\n");

    embed.addFields({ name: "Available Roles", value: roleList });

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
          .setCustomId(`role_toggle_${role.roleId}`)
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
}

module.exports = new RoleService(); 