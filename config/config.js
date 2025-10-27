require("dotenv").config();

module.exports = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    welcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID, // Optional: specific welcome channel
    approvalChannelId: process.env.DISCORD_APPROVAL_CHANNEL_ID, // Optional: channel for role approval requests
  },
  kms: {
    channelId: process.env.KMS_CHANNEL_ID, // Discord channel ID for Klubmesterskab updates
    roleId: process.env.KMS_ROLE_ID || '1413793742808416377', // Klubmesterskab role ID
    eventIso: process.env.KMS_EVENT_ISO, // ISO datetime for event start, e.g., 2025-10-28T18:30:00Z (19:30 CET)
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  server: {
    port: 3000,
    keepAliveUrl: "https://bot-tdnm.onrender.com",
    keepAliveInterval: 24 * 60 * 60 * 1000, // 24 hours. Not needed anymore. Remove at some point
  },
  contentApi: {
    baseUrl: process.env.CONTENT_API_BASE_URL, // Your Google Cloud Function URL
    apiKey: process.env.CONTENT_API_KEY,       // API key for authentication
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,        // OpenAI API key for AI chat features
  },
}; 
