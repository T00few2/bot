const express = require("express");
const axios = require("axios");
const config = require("../config/config");

function setupKeepAliveServer() {
  // Fake Web Server (to keep Render awake)
  const app = express();
  app.get("/", (req, res) => res.send("Bot is running!"));
  app.listen(config.server.port, () => 
    console.log(`Fake web server running on port ${config.server.port}`)
  );

  // Keep-Alive Ping
  setInterval(async () => {
    try {
      await axios.get(config.server.keepAliveUrl);
      console.log("✅ Keep-alive ping sent to prevent sleeping.");
    } catch (error) {
      console.error("❌ Keep-alive ping failed:", error);
    }
  }, config.server.keepAliveInterval);
}

module.exports = {
  setupKeepAliveServer,
}; 