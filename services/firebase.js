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

module.exports = {
  db,
  getUserZwiftId,
  linkUserZwiftId,
  getTodaysClubStats,
  searchRidersByName,
}; 