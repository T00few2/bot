require("dotenv").config();

module.exports = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    welcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID, // Optional: specific welcome channel
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  server: {
    port: 3000,
    keepAliveUrl: "https://bot-tdnm.onrender.com",
    keepAliveInterval: 10 * 60 * 1000, // 10 minutes
  },
  contentApi: {
    baseUrl: process.env.CONTENT_API_BASE_URL, // Your Google Cloud Function URL
    apiKey: process.env.CONTENT_API_KEY,       // API key for authentication
  },
}; 