const { EmbedBuilder } = require("discord.js");
const { db, setBotState, getBotState } = require("./firebase");

// Unicode regional indicator letters for A-D
const LETTER_EMOJIS = {
  A: "🇦",
  B: "🇧",
  C: "🇨",
  D: "🇩",
};

const EMOJI_TO_LETTER = Object.fromEntries(
  Object.entries(LETTER_EMOJIS).map(([k, v]) => [v, k])
);

function getSignupDocId(guildId, messageId) {
  return `${guildId}_${messageId}`;
}

function normalizeEmojiName(name) {
  // Support both regional indicator and raw letters just in case
  if (!name) return null;
  if (EMOJI_TO_LETTER[name]) return EMOJI_TO_LETTER[name];
  const upper = name.toUpperCase();
  if (["A", "B", "C", "D"].includes(upper)) return upper;
  return null;
}

async function getBoardByMessage(guildId, messageId) {
  const docId = getSignupDocId(guildId, messageId);
  const snap = await db.collection("signup_boards").doc(docId).get();
  return snap.exists ? { id: docId, ...snap.data() } : null;
}

async function saveBoard(board) {
  const { id, ...data } = board;
  await db.collection("signup_boards").doc(id).set(data, { merge: true });
}

function renderSignupEmbed(board, guild) {
  const divisions = board.divisions || ["D", "C", "B", "A"]; // default order
  const signups = board.signups || { A: [], B: [], C: [], D: [] };

  const embed = new EmbedBuilder()
    .setTitle("ZRL holdinteresser: A / B / C / D")
    .setDescription(
      "Reager nedenfor hvis du er interesseret i at køre for et ZRL hold i din division.\n" +
        `${LETTER_EMOJIS.D} = D • ${LETTER_EMOJIS.C} = C • ${LETTER_EMOJIS.B} = B • ${LETTER_EMOJIS.A} = A\n` +
        "Fjern din reaktion hvis du ikke længere er interesseret."
    )
    .setColor(0x5865f2)
    .setFooter({ text: guild?.name || "ZRL holdinteresser" })
    .setTimestamp();

  for (const div of divisions) {
    const users = (signups[div] || []).filter(Boolean);
    const mentionList = users
      .slice(0, 20)
      .map((id) => `<@${id}>`)
      .join("\n");
    const extra = users.length > 20 ? `\n+${users.length - 20} more` : "";
    embed.addFields({
      name: `Division ${div} (${users.length})`,
      value: users.length ? `${mentionList}${extra}` : "—",
      inline: false,
    });
  }

  return embed;
}

async function postSignupBoard(channel) {
  const guildId = channel.guild.id;
  const divisions = ["D", "C", "B", "A"]; // Display order in embed
  const initialBoard = {
    guildId,
    channelId: channel.id,
    messageId: null,
    divisions,
    signups: { A: [], B: [], C: [], D: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tempEmbed = renderSignupEmbed(initialBoard, channel.guild);
  const message = await channel.send({ embeds: [tempEmbed] });

  // Persist board now that we have messageId
  const boardId = getSignupDocId(guildId, message.id);
  const board = { id: boardId, ...initialBoard, messageId: message.id };
  await saveBoard(board);

  // Remember latest board per channel for easy repost
  await setBotState(`signup_board_latest:${guildId}:${channel.id}`, {
    boardId,
    messageId: message.id,
    channelId: channel.id,
    guildId,
    updatedAt: Date.now(),
  });

  // Add reactions
  await message.react(LETTER_EMOJIS.D);
  await message.react(LETTER_EMOJIS.C);
  await message.react(LETTER_EMOJIS.B);
  await message.react(LETTER_EMOJIS.A);

  return { board, message };
}

async function repostSignupBoard(channel) {
  const guildId = channel.guild.id;
  const state = await getBotState(`signup_board_latest:${guildId}:${channel.id}`);
  if (!state?.boardId) {
    throw new Error("No existing signup board found for this channel.");
  }
  const snap = await db.collection("signup_boards").doc(state.boardId).get();
  if (!snap.exists) {
    throw new Error("Signup board state refers to a missing record.");
  }
  const board = { id: state.boardId, ...snap.data() };

  // Post new message with current state
  const embed = renderSignupEmbed(board, channel.guild);
  const message = await channel.send({ embeds: [embed] });

  // Update stored messageId and latest pointer
  board.messageId = message.id;
  board.updatedAt = Date.now();
  board.id = getSignupDocId(guildId, message.id);
  await saveBoard(board);
  await setBotState(`signup_board_latest:${guildId}:${channel.id}`, {
    boardId: board.id,
    messageId: message.id,
    channelId: channel.id,
    guildId,
    updatedAt: Date.now(),
  });

  // Add reactions
  await message.react(LETTER_EMOJIS.D);
  await message.react(LETTER_EMOJIS.C);
  await message.react(LETTER_EMOJIS.B);
  await message.react(LETTER_EMOJIS.A);

  return { board, message };
}

async function updateMessageEmbed(message) {
  const guildId = message.guild.id;
  const board = await getBoardByMessage(guildId, message.id);
  if (!board) return;
  const embed = renderSignupEmbed(board, message.guild);
  await message.edit({ embeds: [embed] });
}

async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  const guildId = reaction.message.guild?.id;
  if (!guildId) return;
  const letter = normalizeEmojiName(reaction.emoji.name);
  if (!letter) return;

  const board = await getBoardByMessage(guildId, reaction.message.id);
  if (!board) return; // Not a signup board

  // Ensure signup arrays
  board.signups = board.signups || { A: [], B: [], C: [], D: [] };

  // Remove from other divisions to enforce single choice
  for (const k of ["A", "B", "C", "D"]) {
    board.signups[k] = (board.signups[k] || []).filter((id) => id !== user.id);
  }
  // Add to selected division
  const list = new Set(board.signups[letter] || []);
  list.add(user.id);
  board.signups[letter] = Array.from(list);
  board.updatedAt = Date.now();
  await saveBoard(board);
  await updateMessageEmbed(reaction.message);
}

async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  const guildId = reaction.message.guild?.id;
  if (!guildId) return;
  const letter = normalizeEmojiName(reaction.emoji.name);
  if (!letter) return;

  const board = await getBoardByMessage(guildId, reaction.message.id);
  if (!board) return;

  board.signups = board.signups || { A: [], B: [], C: [], D: [] };
  board.signups[letter] = (board.signups[letter] || []).filter((id) => id !== user.id);
  board.updatedAt = Date.now();
  await saveBoard(board);
  await updateMessageEmbed(reaction.message);
}

module.exports = {
  LETTER_EMOJIS,
  postSignupBoard,
  repostSignupBoard,
  handleReactionAdd,
  handleReactionRemove,
};


