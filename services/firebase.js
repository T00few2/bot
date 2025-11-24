const admin = require("firebase-admin");
const config = require("../config/config");

// Initialize Firebase
const privateKey = config.firebase.privateKey;
if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
  databaseURL: `https://${config.firebase.projectId}.firebaseio.com`,
});

const db = admin.firestore();

/**
 * Get user's linked ZwiftID from Discord ID
 */
async function getUserZwiftId(discordId) {
  const doc = await db.collection("discord_users").doc(discordId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data().zwiftID;
}

/**
 * Link a Discord user to a ZwiftID
 */
async function linkUserZwiftId(discordId, username, zwiftId) {
  await db.collection("discord_users").doc(discordId).set({
    discordID: discordId,
    username,
    zwiftID: zwiftId,
    linkedAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Get today's club stats
 */
async function getTodaysClubStats() {
  const dateId = new Date().toISOString().split("T")[0];
  const clubDoc = await db.collection("club_stats").doc(dateId).get();
  
  if (!clubDoc.exists) {
    return null;
  }
  
  const docData = clubDoc.data();
  if (!docData?.data?.riders) {
    return null;
  }
  
  return docData.data.riders;
}

/**
 * Search for riders by name prefix
 */
async function searchRidersByName(searchTerm) {
  const riders = await getTodaysClubStats();
  if (!riders) {
    return [];
  }
  
  const lowerSearch = searchTerm.toLowerCase();
  return riders.filter(r => 
    r.name && r.name.toLowerCase().startsWith(lowerSearch)
  );
}

/**
 * Simple key-value bot state storage
 */
async function getBotState(key) {
  const doc = await db.collection("bot_state").doc(String(key)).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function setBotState(key, data) {
  await db.collection("bot_state").doc(String(key)).set(data, { merge: true });
}

/**
 * Get self-assignable role panels (same structure as used by the web role manager)
 */
async function getRolePanels() {
  const guildId = config.discord.guildId;
  // Preferred: use explicit guildId
  if (guildId) {
    const doc = await db.collection("selfRoles").doc(guildId).get();
    if (doc.exists) {
      return doc.data(); // { panels: { panelId: { ... } } }
    }
  }

  // Fallback: use first selfRoles document (for environments where DISCORD_GUILD_ID is not set)
  const snap = await db.collection("selfRoles").limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Derive structured DZR teams and race series from role panel data.
 * - Team = role with isTeamRole === true AND teamCaptainId set
 * - Series = role with no teamCaptainId (typically access to series channels)
 */
async function getDZRTeamsAndSeries() {
  const data = await getRolePanels();
  if (!data || !data.panels) {
    return { teams: [], series: [] };
  }

  const teams = [];
  const series = [];

  for (const [panelId, panel] of Object.entries(data.panels)) {
    const panelName = panel.name || panelId;
    const panelDescription = panel.description || "";
    const channelId = panel.channelId || null;

    for (const role of panel.roles || []) {
      const isTeam = !!role.isTeamRole && !!role.teamCaptainId;

      const base = {
        roleId: role.roleId,
        roleName: role.roleName || role.roleId,
        panelId,
        panelName,
        panelDescription,
        channelId,
        buttonColor: role.buttonColor || "Secondary",
        visibility: role.visibility || "public",
      };

      if (isTeam) {
        teams.push({
          ...base,
          teamName: role.teamName || base.roleName,
          raceSeries: role.raceSeries || null,
          division: role.division || null,
          rideTime: role.rideTime || null,
          lookingForRiders: !!role.lookingForRiders,
          teamCaptainId: role.teamCaptainId || null,
          captainDisplayName: role.captainDisplayName || null,
        });
      } else {
        series.push({
          ...base,
          raceSeries: role.raceSeries || null,
          requiresApproval: !!role.requiresApproval,
        });
      }
    }
  }

  return { teams, series };
}

/**
 * Get a single bot knowledge entry by key
 */
async function getBotKnowledge(key) {
  const doc = await db.collection("bot_knowledge").doc(String(key)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Get all bot knowledge entries
 */
async function getAllBotKnowledge() {
  const snap = await db.collection("bot_knowledge").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = {
  db,
  getUserZwiftId,
  linkUserZwiftId,
  getTodaysClubStats,
  searchRidersByName,
  getBotState,
  setBotState,
  getRolePanels,
  getDZRTeamsAndSeries,
  getBotKnowledge,
  getAllBotKnowledge,
}; 