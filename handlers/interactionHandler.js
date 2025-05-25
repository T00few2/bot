const { ActionRowBuilder, StringSelectMenuBuilder, InteractionResponseType, MessageFlags } = require("discord.js");
const roleService = require("../services/roleService");
const { linkUserZwiftId, getTodaysClubStats } = require("../services/firebase");
const { handlePublishButton, ephemeralReplyWithPublish } = require("../utils/ephemeralStore");
const {
  handleMyZwiftId,
  handleSetZwiftId,
  handleGetZwiftId,
  handleRiderStats,
  handleTeamStats,
  handleBrowseRiders,
  handleEventResults,
  handleWhoAmI,
  handleTestWelcome,
} = require("./commandHandlers");
const {
  handleSetupRoles,
  handleAddSelfRole,
  handleRemoveSelfRole,
  handleRolesPanel,
  handleRolesHelp,
} = require("./roleHandlers");
const crypto = require("crypto");

const HANDLER_ID = crypto.randomUUID().slice(0, 8); // Unique ID for this handler instance

async function handleSelectMenus(interaction) {
  if (interaction.customId === "select_rider") {
    try {
      const [selectedValue] = interaction.values;
      await interaction.deferUpdate();
      
      const allRiders = await getTodaysClubStats();
      if (!allRiders) {
        await interaction.editReply("❌ No club_stats found for today.");
        return;
      }
      
      const chosen = allRiders.find(r => r.riderId === parseInt(selectedValue));
      if (!chosen) {
        await interaction.editReply("❌ Could not find that rider in today's list!");
        return;
      }
      
      const content = `**${chosen.name}** has ZwiftID: **${chosen.riderId}**`;
      await ephemeralReplyWithPublish(interaction, content);
    } catch (error) {
      console.error("❌ select_rider Error:", error);
      if (!interaction.replied) {
        await interaction.editReply("⚠️ Error selecting rider.");
      }
    }
    return;
  } 
  
  if (interaction.customId === "myzwift_select") {
    try {
      const [selectedValue] = interaction.values;
      await interaction.deferUpdate();
      const discordID = interaction.user.id;
      const username = interaction.user.username;
      
      await linkUserZwiftId(discordID, username, selectedValue);
      const content = `✅ You have selected rider ZwiftID: **${selectedValue}**. It is now linked to your Discord profile!`;
      await ephemeralReplyWithPublish(interaction, content);
    } catch (error) {
      console.error("❌ myzwift_select error:", error);
      if (!interaction.replied) {
        await interaction.editReply("⚠️ Error linking ZwiftID.");
      }
    }
    return;
  } 
  
  if (interaction.customId.startsWith("setzwift_select_")) {
    try {
      // Custom select for /set_zwiftid command: customId format: setzwift_select_<targetUserId>
      const parts = interaction.customId.split("_");
      const targetUserId = parts[2];
      const [selectedValue] = interaction.values;
      await interaction.deferUpdate();
      
      const targetUser = await interaction.client.users.fetch(targetUserId);
      await linkUserZwiftId(targetUserId, targetUser.username, selectedValue);
      const content = `✅ Linked ZwiftID **${selectedValue}** to ${targetUser.username}.`;
      await ephemeralReplyWithPublish(interaction, content);
    } catch (error) {
      console.error("❌ setzwift_select error:", error);
      if (!interaction.replied) {
        await interaction.editReply("⚠️ Error linking ZwiftID.");
      }
    }
    return;
  }
}

async function handleInteractions(interaction) {
  try {
    console.log(`🔍 [${HANDLER_ID}] Handling interaction: ${interaction.type} - ${interaction.isCommand() ? interaction.commandName : 'N/A'} (ID: ${interaction.id})`);
    
    // Handle publish buttons
    if (interaction.isButton() && interaction.customId.startsWith("publish_")) {
      const uniqueId = interaction.customId.replace("publish_", "");
      await handlePublishButton(interaction, uniqueId);
      return;
    }

    // Handle role toggle buttons
    if (interaction.isButton() && interaction.customId.startsWith("role_toggle_")) {
      const roleId = interaction.customId.replace("role_toggle_", "");
      try {
        await interaction.deferReply({ ephemeral: true });
        
        const result = await roleService.toggleUserRole(
          interaction.guild,
          interaction.user.id,
          roleId
        );

        const emoji = result.action === "added" ? "✅" : "❌";
        const actionText = result.action === "added" ? "added" : "removed";
        
        await interaction.editReply(`${emoji} Successfully ${actionText} the **${result.roleName}** role!`);
      } catch (error) {
        console.error("Error handling role toggle:", error);
        await interaction.editReply(`❌ Error: ${error.message}`);
      }
      return;
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenus(interaction);
      return;
    }

    // Handle slash commands
    if (!interaction.isCommand()) return;
    
    console.log(`🔄 [${HANDLER_ID}] Interaction state before response: replied=${interaction.replied}, deferred=${interaction.deferred}`);
    
    // Add a small delay to see if this helps with timing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try immediate reply instead of defer to avoid timing issues
    if (!interaction.replied && !interaction.deferred) {
      console.log(`⏳ [${HANDLER_ID}] Attempting to reply to interaction ${interaction.id}`);
      try {
        await interaction.reply({ 
          content: "⏳ Processing command...", 
          flags: MessageFlags.Ephemeral 
        });
        console.log(`✅ [${HANDLER_ID}] Successfully replied to interaction`);
      } catch (replyError) {
        console.log(`❌ [${HANDLER_ID}] Failed to reply to interaction: ${replyError.message}`);
        if (replyError.code === 40060) { // Already acknowledged
          console.log(`🔄 [${HANDLER_ID}] Interaction was already acknowledged by another handler`);
          return; // Exit gracefully
        }
        throw replyError; // Re-throw other errors
      }
    } else {
      console.log(`⚠️ [${HANDLER_ID}] Interaction already acknowledged, skipping reply`);
      return; // Exit if already handled
    }
    
    const commandName = interaction.commandName;

    const commandHandlers = {
      "my_zwiftid": handleMyZwiftId,
      "set_zwiftid": handleSetZwiftId,
      "get_zwiftid": handleGetZwiftId,
      "whoami": handleWhoAmI,
      "rider_stats": handleRiderStats,
      "team_stats": handleTeamStats,
      "browse_riders": handleBrowseRiders,
      "event_results": handleEventResults,
      "test_welcome": handleTestWelcome,
      "setup_roles": handleSetupRoles,
      "add_selfrole": handleAddSelfRole,
      "remove_selfrole": handleRemoveSelfRole,
      "roles_panel": handleRolesPanel,
      "roles_help": handleRolesHelp,
    };

    const handler = commandHandlers[commandName];
    if (handler) {
      await handler(interaction);
    } else {
      await interaction.editReply({ content: "❌ Unknown command." });
    }

  } catch (error) {
    console.error(`❌ [${HANDLER_ID}] Unexpected Error:`, error);
    try {
      // Check current interaction state before trying to respond
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: "⚠️ An unexpected error occurred!", 
          flags: MessageFlags.Ephemeral 
        });
      } else if (interaction.replied) {
        // Already replied, edit the reply
        await interaction.editReply({ content: "⚠️ An unexpected error occurred!" });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: "⚠️ An unexpected error occurred!" });
      } else {
        // Fallback: try follow-up
        await interaction.followUp({ 
          content: "⚠️ An unexpected error occurred!", 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (responseError) {
      console.error(`❌ [${HANDLER_ID}] Could not respond to interaction:`, responseError);
    }
  }
}

module.exports = {
  handleInteractions,
}; 