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
    console.log(`🔄 API Call: Fetching due scheduled messages...`);
    console.log(`   URL: ${API_BASE_URL}/api/schedules/due`);
    
    const response = await axios.get(`${API_BASE_URL}/api/schedules/due`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    console.log(`✅ API Response: Received ${response.data.length} due messages`);
    
    if (response.data.length > 0) {
      console.log(`📋 Due messages:`, response.data.map(msg => ({
        id: msg.id,
        title: msg.title,
        channel_id: msg.channel_id,
        next_run: msg.next_run,
        last_sent: msg.last_sent
      })));
    }
    
    return response.data;
  } catch (error) {
    console.error("❌ API Error fetching scheduled messages:", error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get messages selected for probability-based sending
 */
async function getProbabilitySelectedMessages() {
  try {
    console.log(`🔄 API Call: Checking probability-based messages...`);
    console.log(`   URL: ${API_BASE_URL}/api/schedules/probability-check`);
    
    const response = await axios.post(`${API_BASE_URL}/api/schedules/probability-check`, {}, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    console.log(`✅ API Response: Probability check completed`);
    console.log(`   Messages to send: ${response.data.messages_to_send.length}`);
    console.log(`   Total eligible: ${response.data.total_eligible}`);
    console.log(`   Channels checked: ${response.data.channels_checked}`);
    
    if (response.data.messages_to_send.length > 0) {
      console.log(`📋 Selected messages:`, response.data.messages_to_send.map(msg => ({
        id: msg.id,
        title: msg.title,
        channel_id: msg.channel_id,
        likelihood: msg.schedule?.likelihood || 1.0,
        daily_probability: msg.schedule?.daily_probability || 0.1
      })));
    }
    
    return response.data.messages_to_send;
  } catch (error) {
    console.error("❌ API Error checking probability messages:", error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Mark a scheduled message as sent
 */
async function markScheduledMessageSent(scheduleId) {
  try {
    console.log(`🔄 API Call: Marking schedule ${scheduleId} as sent...`);
    console.log(`   URL: ${API_BASE_URL}/api/schedules/${scheduleId}/sent`);
    
    const response = await axios.post(`${API_BASE_URL}/api/schedules/${scheduleId}/sent`, {}, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    console.log(`✅ API Response: Schedule ${scheduleId} marked as sent successfully`);
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response data:`, response.data);
    
  } catch (error) {
    console.error(`❌ API Error marking schedule ${scheduleId} as sent:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
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
  getProbabilitySelectedMessages,
  markScheduledMessageSent,
  processMessageContent,
}; 