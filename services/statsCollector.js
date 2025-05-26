const { db } = require('./firebase');

class StatsCollector {
  constructor() {
    this.activityBuffer = {
      messages: [],
      reactions: [],
      voiceActivity: [],
      interactions: []
    };
    this.lastSave = Date.now();
    this.ACTIVITY_THRESHOLD = 25; // Save when 25 activities accumulated
    this.MAX_WAIT_TIME = 24 * 60 * 60 * 1000; // 24 hours max wait
  }

  /**
   * Add message activity to buffer
   */
  addMessage(message) {
    if (message.author.bot) return; // Skip bot messages
    
    this.activityBuffer.messages.push({
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channel.id,
      channelName: message.channel.name,
      timestamp: Date.now(),
      messageLength: message.content.length,
      hasAttachments: message.attachments.size > 0
    });
    
    this.checkSaveConditions();
  }

  /**
   * Add reaction activity to buffer
   */
  addReaction(reaction, user) {
    if (user.bot) return; // Skip bot reactions
    
    this.activityBuffer.reactions.push({
      userId: user.id,
      username: user.username,
      channelId: reaction.message.channel.id,
      channelName: reaction.message.channel.name,
      emoji: reaction.emoji.name,
      timestamp: Date.now()
    });
    
    this.checkSaveConditions();
  }

  /**
   * Add voice activity to buffer
   */
  addVoiceActivity(oldState, newState) {
    const user = newState.member.user;
    if (user.bot) return; // Skip bot voice activity
    
    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      this.activityBuffer.voiceActivity.push({
        userId: user.id,
        username: user.username,
        channelId: newState.channel.id,
        channelName: newState.channel.name,
        action: 'join',
        timestamp: Date.now()
      });
    }
    
    // User left a voice channel
    if (oldState.channel && !newState.channel) {
      this.activityBuffer.voiceActivity.push({
        userId: user.id,
        username: user.username,
        channelId: oldState.channel.id,
        channelName: oldState.channel.name,
        action: 'leave',
        timestamp: Date.now()
      });
    }
    
    this.checkSaveConditions();
  }

  /**
   * Add interaction (slash command) activity to buffer
   */
  addInteraction(interaction) {
    if (interaction.user.bot) return; // Skip bot interactions
    
    this.activityBuffer.interactions.push({
      userId: interaction.user.id,
      username: interaction.user.username,
      commandName: interaction.commandName,
      channelId: interaction.channel?.id,
      channelName: interaction.channel?.name,
      timestamp: Date.now()
    });
    
    this.checkSaveConditions();
  }

  /**
   * Get total activity count across all types
   */
  getTotalActivityCount() {
    return this.activityBuffer.messages.length + 
           this.activityBuffer.reactions.length + 
           this.activityBuffer.voiceActivity.length +
           this.activityBuffer.interactions.length;
  }

  /**
   * Check if we should save based on threshold or time
   */
  checkSaveConditions() {
    const totalActivities = this.getTotalActivityCount();
    const timeSinceLastSave = Date.now() - this.lastSave;
    
    const shouldSave = 
      totalActivities >= this.ACTIVITY_THRESHOLD ||
      timeSinceLastSave >= this.MAX_WAIT_TIME;
      
    if (shouldSave && totalActivities > 0) {
      this.saveActivitySummary();
    }
  }

  /**
   * Force save current buffer (useful for bot shutdown)
   */
  forceSave() {
    if (this.getTotalActivityCount() > 0) {
      this.saveActivitySummary();
    }
  }

  /**
   * Save aggregated activity summary to Firebase
   */
  async saveActivitySummary() {
    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Aggregate data by user and channel
      const summary = this.aggregateActivityData();
      
      // Save to Firebase
      await db.collection('server_activity').add({
        timestamp,
        dateKey,
        periodStart: new Date(this.lastSave).toISOString(),
        periodEnd: timestamp,
        totalActivities: this.getTotalActivityCount(),
        summary,
        rawData: {
          messageCount: this.activityBuffer.messages.length,
          reactionCount: this.activityBuffer.reactions.length,
          voiceActivityCount: this.activityBuffer.voiceActivity.length,
          interactionCount: this.activityBuffer.interactions.length
        }
      });
      
      console.log(`✅ Saved activity summary: ${this.getTotalActivityCount()} activities from ${new Date(this.lastSave).toLocaleString()} to ${now.toLocaleString()}`);
      
      // Clear buffer and reset timer
      this.clearBuffer();
      this.lastSave = Date.now();
      
    } catch (error) {
      console.error('❌ Error saving activity summary:', error);
    }
  }

  /**
   * Aggregate raw activity data into summary statistics
   */
  aggregateActivityData() {
    const userActivity = {};
    const channelActivity = {};
    
    // Process messages
    this.activityBuffer.messages.forEach(msg => {
      // User stats
      if (!userActivity[msg.userId]) {
        userActivity[msg.userId] = {
          username: msg.username,
          messages: 0,
          reactions: 0,
          voiceActivity: 0,
          interactions: 0,
          channelsActive: new Set()
        };
      }
      userActivity[msg.userId].messages++;
      userActivity[msg.userId].channelsActive.add(msg.channelId);
      
      // Channel stats
      if (!channelActivity[msg.channelId]) {
        channelActivity[msg.channelId] = {
          channelName: msg.channelName,
          messages: 0,
          reactions: 0,
          activeUsers: new Set()
        };
      }
      channelActivity[msg.channelId].messages++;
      channelActivity[msg.channelId].activeUsers.add(msg.userId);
    });
    
    // Process reactions
    this.activityBuffer.reactions.forEach(reaction => {
      if (!userActivity[reaction.userId]) {
        userActivity[reaction.userId] = {
          username: reaction.username,
          messages: 0,
          reactions: 0,
          voiceActivity: 0,
          interactions: 0,
          channelsActive: new Set()
        };
      }
      userActivity[reaction.userId].reactions++;
      userActivity[reaction.userId].channelsActive.add(reaction.channelId);
      
      if (!channelActivity[reaction.channelId]) {
        channelActivity[reaction.channelId] = {
          channelName: reaction.channelName,
          messages: 0,
          reactions: 0,
          activeUsers: new Set()
        };
      }
      channelActivity[reaction.channelId].reactions++;
      channelActivity[reaction.channelId].activeUsers.add(reaction.userId);
    });
    
    // Process voice activity
    this.activityBuffer.voiceActivity.forEach(voice => {
      if (!userActivity[voice.userId]) {
        userActivity[voice.userId] = {
          username: voice.username,
          messages: 0,
          reactions: 0,
          voiceActivity: 0,
          interactions: 0,
          channelsActive: new Set()
        };
      }
      userActivity[voice.userId].voiceActivity++;
    });
    
    // Process interactions
    this.activityBuffer.interactions.forEach(interaction => {
      if (!userActivity[interaction.userId]) {
        userActivity[interaction.userId] = {
          username: interaction.username,
          messages: 0,
          reactions: 0,
          voiceActivity: 0,
          interactions: 0,
          channelsActive: new Set()
        };
      }
      userActivity[interaction.userId].interactions++;
      if (interaction.channelId) {
        userActivity[interaction.userId].channelsActive.add(interaction.channelId);
      }
    });
    
    // Convert Sets to counts for JSON serialization
    Object.values(userActivity).forEach(user => {
      user.channelsActive = user.channelsActive.size;
    });
    
    Object.values(channelActivity).forEach(channel => {
      channel.activeUsers = channel.activeUsers.size;
    });
    
    return {
      userActivity,
      channelActivity
    };
  }

  /**
   * Clear the activity buffer
   */
  clearBuffer() {
    this.activityBuffer = {
      messages: [],
      reactions: [],
      voiceActivity: [],
      interactions: []
    };
  }
}

module.exports = { StatsCollector }; 