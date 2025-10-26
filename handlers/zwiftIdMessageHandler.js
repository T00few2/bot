const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { linkUserZwiftId, getUserZwiftId } = require("../services/firebase");
const { checkVerificationAfterZwiftLink } = require("./memberHandler");

// Store pending confirmations temporarily (cleared after 5 minutes)
const pendingConfirmations = new Map();

/**
 * Detect if a message contains a Zwift ID in various formats
 * Patterns: "ZwiftID : 123456", "zwiftid 123456", "zwift id: 123456", etc.
 * @param {string} content - The message content
 * @returns {string|null} - The extracted Zwift ID or null
 */
function detectZwiftIdPattern(content) {
  // Pattern: zwift (optional space) id (optional colon/space) <number>
  // Case insensitive, flexible whitespace
  const patterns = [
    /zwift\s*id\s*[:\-]?\s*(\d{5,})/i,  // "zwiftid: 123456", "zwift id 123456"
    /zwift\s*[:\-]?\s*(\d{5,})/i,        // "zwift: 123456", "zwift 123456"
    /zid\s*[:\-]?\s*(\d{5,})/i,          // "zid: 123456", "zid 123456"
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1]; // Return the captured group (the ID)
    }
  }

  return null;
}

/**
 * Handle messages that might contain a Zwift ID
 * @param {Message} message - Discord message object
 */
async function handleZwiftIdMessage(message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only process messages in the specific channel
  const ZWIFT_ID_CHANNEL = '1381263324934832219';
  if (message.channel.id !== ZWIFT_ID_CHANNEL) return;

  const zwiftId = detectZwiftIdPattern(message.content);
  
  // If no Zwift ID pattern detected, return early
  if (!zwiftId) return;

  try {
    // Check if user already has a linked Zwift ID
    const existingZwiftId = await getUserZwiftId(message.author.id);
    
    // Create embed for confirmation
    const embed = new EmbedBuilder()
      .setColor(existingZwiftId ? 0xFF9900 : 0x00FF00) // Orange if updating, green if new
      .setTitle("🔗 Zwift ID Confirmation")
      .setDescription(
        existingZwiftId
          ? `You're about to **update** your linked Zwift ID from **${existingZwiftId}** to **${zwiftId}**`
          : `You're about to link Zwift ID **${zwiftId}** to your Discord account`
      )
      .addFields([
        { name: "👤 Discord User", value: message.author.tag, inline: true },
        { name: "🚴 Zwift ID", value: zwiftId, inline: true }
      ])
      .setFooter({ text: "Please confirm this is correct" })
      .setTimestamp();

    if (existingZwiftId) {
      embed.addFields([
        { 
          name: "⚠️ Note", 
          value: "Updating your Zwift ID will replace your current linked ID", 
          inline: false 
        }
      ]);
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_zwiftid_${message.author.id}_${zwiftId}`)
      .setLabel("✅ Confirm")
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_zwiftid_${message.author.id}`)
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    // Send confirmation message
    const confirmationMsg = await message.reply({
      embeds: [embed],
      components: [row]
    });

    // Store pending confirmation with timeout
    const confirmationId = `${message.author.id}_${Date.now()}`;
    pendingConfirmations.set(confirmationId, {
      userId: message.author.id,
      zwiftId: zwiftId,
      messageId: confirmationMsg.id,
      channelId: message.channel.id,
      originalMessage: message
    });

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      if (pendingConfirmations.has(confirmationId)) {
        pendingConfirmations.delete(confirmationId);
        try {
          confirmationMsg.edit({
            components: [] // Remove buttons
          }).catch(() => {}); // Ignore errors if message was deleted
        } catch (error) {
          // Ignore errors
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

  } catch (error) {
    console.error("Error handling Zwift ID message:", error);
    try {
      await message.reply("⚠️ An error occurred while processing your Zwift ID. Please try again or use `/my_zwiftid` command.");
    } catch (replyError) {
      // Ignore if we can't reply
    }
  }
}

/**
 * Handle button interactions for Zwift ID confirmation
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
async function handleZwiftIdConfirmation(interaction) {
  const customId = interaction.customId;

  // Handle confirmation
  if (customId.startsWith("confirm_zwiftid_")) {
    const parts = customId.split("_");
    const userId = parts[2];
    const zwiftId = parts[3];

    // Verify the interaction is from the correct user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You cannot confirm someone else's Zwift ID linking.",
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      // Link the Zwift ID
      await linkUserZwiftId(userId, interaction.user.username, zwiftId);

      // Update the original message to show it's been confirmed
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle("✅ Zwift ID Linked Successfully")
        .setDescription(`Your Zwift ID **${zwiftId}** has been linked to your Discord account!`)
        .addFields([
          { name: "👤 Discord User", value: interaction.user.tag, inline: true },
          { name: "🚴 Zwift ID", value: zwiftId, inline: true }
        ])
        .setFooter({ text: "You can update this anytime by sending a new message" })
        .setTimestamp();

      await interaction.message.edit({
        embeds: [successEmbed],
        components: [] // Remove buttons
      });

      await interaction.editReply({
        content: "✅ Your Zwift ID has been successfully linked! You can now use commands like `/whoami` and `/rider_stats`."
      });

      // Check verification status after linking
      if (interaction.guild) {
        await checkVerificationAfterZwiftLink(interaction.guild, userId);
      }

      // Clean up pending confirmations
      for (const [key, value] of pendingConfirmations.entries()) {
        if (value.userId === userId) {
          pendingConfirmations.delete(key);
        }
      }

    } catch (error) {
      console.error("Error confirming Zwift ID:", error);
      await interaction.editReply({
        content: "⚠️ An error occurred while linking your Zwift ID. Please try again or use `/my_zwiftid` command."
      });
    }
  }

  // Handle cancellation
  if (customId.startsWith("cancel_zwiftid_")) {
    const parts = customId.split("_");
    const userId = parts[2];

    // Verify the interaction is from the correct user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You cannot cancel someone else's Zwift ID linking.",
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      // Update the original message to show it's been cancelled
      const cancelEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("❌ Zwift ID Linking Cancelled")
        .setDescription("The Zwift ID linking has been cancelled.")
        .setFooter({ text: "Send a new message to try again" })
        .setTimestamp();

      await interaction.message.edit({
        embeds: [cancelEmbed],
        components: [] // Remove buttons
      });

      await interaction.editReply({
        content: "❌ Zwift ID linking cancelled. You can try again anytime!"
      });

      // Clean up pending confirmations
      for (const [key, value] of pendingConfirmations.entries()) {
        if (value.userId === userId) {
          pendingConfirmations.delete(key);
        }
      }

    } catch (error) {
      console.error("Error cancelling Zwift ID:", error);
      await interaction.editReply({
        content: "⚠️ An error occurred while cancelling."
      });
    }
  }
}

module.exports = {
  handleZwiftIdMessage,
  handleZwiftIdConfirmation,
  detectZwiftIdPattern // Export for testing
};

