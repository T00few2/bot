const crypto = require("crypto");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");

/**
 * A global store for ephemeral results.
 * Maps a unique key => { content, files } to allow "Publish to Channel."
 */
const ephemeralStore = new Map();

/**
 * Utility: ephemeralReplyWithPublish
 *  - Generates a unique ID
 *  - Stores ephemeral content in ephemeralStore
 *  - Edits the ephemeral reply to include the content and a "Publish to Channel" button
 */
async function ephemeralReplyWithPublish(interaction, content, files = []) {
  const uniqueId = crypto.randomUUID();
  ephemeralStore.set(uniqueId, { content, files });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish_${uniqueId}`)
      .setLabel("Publish to Channel")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({
    content,
    files,
    components: [row]
  });
}

/**
 * Handle publish button clicks
 */
async function handlePublishButton(interaction, uniqueId) {
  const stored = ephemeralStore.get(uniqueId);
  if (!stored) {
    await interaction.reply({ 
      content: "❌ Could not find the content to publish.", 
      flags: MessageFlags.Ephemeral 
    });
    return false;
  }
  
  ephemeralStore.delete(uniqueId);
  await interaction.deferUpdate();
  await interaction.followUp({
    content: stored.content,
    files: stored.files ?? [],
    ephemeral: false
  });
  await interaction.editReply({ components: [] });
  return true;
}

module.exports = {
  ephemeralStore,
  ephemeralReplyWithPublish,
  handlePublishButton,
}; 