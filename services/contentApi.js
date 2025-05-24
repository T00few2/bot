const axios = require("axios");
const config = require("../config/config");

const API_BASE_URL = config.contentApi.baseUrl;
const API_KEY = config.contentApi.apiKey;

/**
 * Get a random welcome message
 */
async function getWelcomeMessage() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/messages/welcome-messages`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    const messages = response.data.filter(msg => msg.active);
    if (messages.length === 0) return null;
    
    // Return random message
    return messages[Math.floor(Math.random() * messages.length)];
  } catch (error) {
    console.error("❌ Error fetching welcome message:", error);
    return null;
  }
}

/**
 * Get scheduled messages that are due
 */
async function getDueScheduledMessages() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/schedules/due`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching scheduled messages:", error);
    return [];
  }
}

/**
 * Mark a scheduled message as sent
 */
async function markScheduledMessageSent(scheduleId) {
  try {
    await axios.post(`${API_BASE_URL}/api/schedules/${scheduleId}/sent`, {}, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
  } catch (error) {
    console.error("❌ Error marking message as sent:", error);
  }
}

/**
 * Process message content (replace variables)
 */
function processMessageContent(content, variables = {}) {
  let processed = content;
  
  // Replace variables like {username}, {server_name}, etc.
  Object.entries(variables).forEach(([key, value]) => {
    processed = processed.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  
  return processed;
}

module.exports = {
  getWelcomeMessage,
  getDueScheduledMessages,
  markScheduledMessageSent,
  processMessageContent,
}; 