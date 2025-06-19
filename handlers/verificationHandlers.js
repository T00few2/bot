const { EmbedBuilder } = require("discord.js");
const verificationService = require("../services/verificationService");
const { ephemeralReplyWithPublish } = require("../utils/ephemeralStore");

/**
 * Handle setup_verification command
 */
async function handleSetupVerification(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const verifiedRole = interaction.options.getRole("verified_role");
    const requireZwiftId = interaction.options.getBoolean("require_zwiftid") ?? true;
    const minAccountAge = interaction.options.getInteger("minimum_account_age_days");
    const requireServerBoost = interaction.options.getBoolean("require_server_boost") ?? false;

    // Check if the bot can manage the role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    if (verifiedRole.position >= botMember.roles.highest.position) {
      await interaction.editReply("❌ I cannot manage this role because it's higher than or equal to my highest role. Please move my bot role above the verified role or choose a different role.");
      return;
    }

    // Setup verification settings
    const settings = {
      enabled: true,
      verifiedRoleId: verifiedRole.id,
      criteria: {
        requiresZwiftId: requireZwiftId,
        requiresMinimumAccountAge: !!minAccountAge,
        minimumAccountAgeDays: minAccountAge || 0,
        requiresServerBoost: requireServerBoost,
        requiresSpecificRoles: [], // Can be extended later
        requiresActivityThreshold: false
      }
    };

    const success = await verificationService.setVerificationSettings(interaction.guild.id, settings);
    
    if (!success) {
      await interaction.editReply("❌ Failed to setup verification system. Please try again.");
      return;
    }

    // Create setup confirmation embed
    const embed = new EmbedBuilder()
      .setTitle("✅ Verification System Setup Complete")
      .setDescription("Auto-role verification has been configured for this server!")
      .setColor(0x00FF00)
      .addFields([
        { name: "🎭 Verified Role", value: `<@&${verifiedRole.id}>`, inline: true },
        { name: "🚴 Requires ZwiftID", value: requireZwiftId ? "✅ Yes" : "❌ No", inline: true },
        { name: "📅 Min Account Age", value: minAccountAge ? `${minAccountAge} days` : "Not required", inline: true },
        { name: "💎 Requires Server Boost", value: requireServerBoost ? "✅ Yes" : "❌ No", inline: true },
        { name: "🤖 Auto-Processing", value: "Users will be automatically verified when they meet the criteria", inline: false }
      ])
      .setFooter({ text: `${interaction.guild.name} • Verification System` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Process verification for existing members
    console.log(`🔍 Starting background verification processing for ${interaction.guild.name}`);
    verificationService.processGuildVerification(interaction.guild)
      .then(results => {
        console.log(`✅ Background verification complete: ${results.rolesAssigned} assigned, ${results.rolesRemoved} removed`);
      })
      .catch(error => {
        console.error("❌ Background verification failed:", error);
      });

  } catch (error) {
    console.error("Error in handleSetupVerification:", error);
    if (!interaction.replied) {
      await interaction.editReply("❌ An error occurred while setting up verification.");
    }
  }
}

/**
 * Handle verification_status command
 */
async function handleVerificationStatus(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    const status = await verificationService.getVerificationStatus(member);
    
    if (!status) {
      await interaction.editReply("❌ Unable to retrieve verification status.");
      return;
    }

    if (!status.enabled) {
      await interaction.editReply("❌ Verification system is not enabled on this server.");
      return;
    }

    // Create status embed
    const embed = new EmbedBuilder()
      .setTitle(`🔍 Verification Status: ${member.displayName}`)
      .setDescription(`Status for ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(status.meetsAllCriteria ? 0x00FF00 : 0xFF6B6B)
      .setFooter({ text: `${interaction.guild.name} • Verification System` })
      .setTimestamp();

    // Overall status
    embed.addFields([
      { 
        name: "🎭 Overall Status", 
        value: status.meetsAllCriteria 
          ? `✅ **Verified** - Has ${status.verifiedRoleName} role: ${status.hasVerifiedRole ? "✅" : "❌ (will be assigned soon)"}` 
          : `❌ **Not Verified** - Missing requirements`, 
        inline: false 
      }
    ]);

    // Individual criteria
    const criteriaFields = [];
    
    if (status.criteriaResults.hasZwiftId !== undefined) {
      criteriaFields.push({
        name: "🚴 ZwiftID Linked",
        value: status.criteriaResults.hasZwiftId ? "✅ Yes" : "❌ No",
        inline: true
      });
    }

    if (status.criteriaResults.accountAge !== undefined) {
      criteriaFields.push({
        name: "📅 Account Age",
        value: status.criteriaResults.accountAge ? "✅ Meets requirement" : "❌ Too new",
        inline: true
      });
    }

    if (status.criteriaResults.isServerBooster !== undefined) {
      criteriaFields.push({
        name: "💎 Server Booster",
        value: status.criteriaResults.isServerBooster ? "✅ Yes" : "❌ No",
        inline: true
      });
    }

    if (status.criteriaResults.hasRequiredRoles !== undefined) {
      criteriaFields.push({
        name: "🏷️ Required Roles",
        value: status.criteriaResults.hasRequiredRoles ? "✅ All present" : "❌ Missing roles",
        inline: true
      });
    }

    embed.addFields(criteriaFields);

    // Missing criteria
    if (status.missingCriteria.length > 0) {
      embed.addFields([{
        name: "❌ Missing Requirements",
        value: status.missingCriteria.map(criteria => `• ${criteria}`).join("\n"),
        inline: false
      }]);
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Error in handleVerificationStatus:", error);
    if (!interaction.replied) {
      await interaction.editReply("❌ An error occurred while checking verification status.");
    }
  }
}

/**
 * Handle process_verification command
 */
async function handleProcessVerification(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    await interaction.editReply("🔍 **Processing verification for all members...**\n\nThis may take a moment for large servers.");

    const results = await verificationService.processGuildVerification(interaction.guild);

    if (!results.processed && results.reason === "Verification not enabled") {
      await interaction.editReply("❌ Verification system is not enabled on this server. Use `/setup_verification` first.");
      return;
    }

    // Create results embed
    const embed = new EmbedBuilder()
      .setTitle("✅ Verification Processing Complete")
      .setDescription("Processed verification for all server members")
      .setColor(0x00FF00)
      .addFields([
        { name: "🎭 Roles Assigned", value: results.rolesAssigned.toString(), inline: true },
        { name: "🚫 Roles Removed", value: results.rolesRemoved.toString(), inline: true },
        { name: "⚠️ Errors", value: results.errors.toString(), inline: true },
        { name: "👥 Total Processed", value: results.processed.toString(), inline: true }
      ])
      .setFooter({ text: `${interaction.guild.name} • Verification System` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Error in handleProcessVerification:", error);
    if (!interaction.replied) {
      await interaction.editReply("❌ An error occurred while processing verification.");
    }
  }
}

/**
 * Handle disable_verification command
 */
async function handleDisableVerification(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const settings = {
      enabled: false,
      verifiedRoleId: null,
      criteria: {}
    };

    const success = await verificationService.setVerificationSettings(interaction.guild.id, settings);
    
    if (!success) {
      await interaction.editReply("❌ Failed to disable verification system.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🔴 Verification System Disabled")
      .setDescription("Auto-role verification has been disabled for this server.")
      .setColor(0xFF6B6B)
      .addFields([
        { name: "⚠️ Note", value: "Existing verified roles will not be automatically removed. Use `/process_verification` after re-enabling if needed.", inline: false }
      ])
      .setFooter({ text: `${interaction.guild.name} • Verification System` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Error in handleDisableVerification:", error);
    if (!interaction.replied) {
      await interaction.editReply("❌ An error occurred while disabling verification.");
    }
  }
}

module.exports = {
  handleSetupVerification,
  handleVerificationStatus,
  handleProcessVerification,
  handleDisableVerification
}; 