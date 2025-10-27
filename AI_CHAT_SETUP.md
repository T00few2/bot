# AI Chat Bot Setup Guide

This guide explains how to set up the AI-powered natural language interface for your Discord bot.

## Overview

Users can now interact with the bot using natural language by mentioning it:
```
@YourBot show me stats for @Chris
@YourBot compare @John, @Mike, and @Sarah
@YourBot what's my zwift id?
```

The bot uses OpenAI's GPT-4o-mini to understand the request and execute the appropriate command.

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy the key (it starts with `sk-...`)
6. **Important:** Add credits to your account (Settings → Billing)

### 2. Add API Key to Environment Variables

Add this line to your `.env` file in the `bot/` directory:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Install Dependencies

Run this command in the `bot/` directory:

```bash
npm install
```

This will install the `openai` package (version 4.77.0).

### 4. Restart Your Bot

Restart the bot to load the new configuration:

```bash
node bot.js
```

You should see the bot start without any OpenAI warnings.

## Features

### Supported Commands

The AI can understand natural language and execute these commands:

1. **rider_stats** - Get stats for a rider
   - "Show me stats for @Chris"
   - "What are the stats for Zwift ID 123456?"

2. **team_stats** - Compare multiple riders
   - "Compare @John, @Mike, and @Sarah"
   - "Show team stats for @Chris and @Tom"

3. **whoami** - Get your own Zwift ID
   - "What's my Zwift ID?"
   - "Show me my linked ID"

4. **get_zwiftid** - Get someone's Zwift ID
   - "What's @Chris's Zwift ID?"
   - "Show me Chris's linked ID"

5. **my_zwiftid** - Link your Zwift ID
   - "Link my Zwift ID 123456"
   - "Search for my name starting with 'Chr'"

6. **set_zwiftid** - Link someone else's Zwift ID (requires Manage Messages permission)
   - "Set @Chris's Zwift ID to 123456"
   - "Link @John to Zwift ID 789012"

7. **browse_riders** - Search for riders
   - "Search for riders starting with 'And'"
   - "Find riders named Chris"

8. **event_results** - Search event results
   - "Show results for 'DZR Team Race'"
   - "Find events matching 'Sunday'"

### Conversation Context

The bot remembers your conversation for **30 minutes** or the **last 20 messages** (whichever comes first).

This allows follow-up questions:
```
User: @YourBot show stats for @Chris
Bot: [shows Chris's stats]

User: @YourBot now compare him with @John
Bot: [understands "him" = Chris, shows comparison]
```

### Works in All Channels

The AI chat works in **all channels** where the bot has access. Users just need to mention the bot to trigger it.

## Configuration

You can adjust these settings in `bot/handlers/aiChatHandler.js`:

```javascript
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_CONVERSATION_LENGTH = 20;          // 20 messages
```

You can also change the OpenAI model (default is `gpt-4o-mini`):

```javascript
model: "gpt-4o-mini", // Fast and cheap
// or
model: "gpt-4o",      // More powerful but more expensive
```

## Cost Estimates

Using `gpt-4o-mini` (recommended):
- Input: $0.150 / 1M tokens (~$0.0001 per message)
- Output: $0.600 / 1M tokens (~$0.0003 per message)

**Example:** 1,000 messages ≈ $0.40

Using `gpt-4o`:
- Input: $2.50 / 1M tokens (~$0.0015 per message)
- Output: $10.00 / 1M tokens (~$0.005 per message)

**Example:** 1,000 messages ≈ $6.50

💡 **Tip:** Start with `gpt-4o-mini` - it's fast, cheap, and works great for command routing!

## Troubleshooting

### "OpenAI not configured" Warning

**Problem:** Bot starts but shows: `⚠️ OpenAI not configured. AI chat features will be disabled.`

**Solutions:**
1. Check that `OPENAI_API_KEY` is in your `.env` file
2. Make sure the key starts with `sk-`
3. Restart the bot after adding the key

### "Insufficient quota" Error

**Problem:** Bot responds: `⚠️ OpenAI API quota exceeded.`

**Solutions:**
1. Go to [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add payment method and credits
3. Check your usage limits

### "Invalid API key" Error

**Problem:** Bot responds: `⚠️ OpenAI API key is invalid.`

**Solutions:**
1. Generate a new API key on OpenAI platform
2. Make sure you copied the entire key (starts with `sk-`)
3. Update `.env` file with new key
4. Restart bot

### Bot Doesn't Respond

**Problem:** You mention the bot but nothing happens.

**Checklist:**
- ✅ Did you mention the bot? (`@YourBot`)
- ✅ Is the bot online?
- ✅ Does the bot have message permissions in that channel?
- ✅ Is OpenAI configured? (Check bot startup logs)

## Testing

Test the AI chat with these examples:

```
@YourBot hello

@YourBot what can you do?

@YourBot show me stats for @[YourUsername]

@YourBot what's my zwift id?

@YourBot search for riders starting with "Chr"
```

## Privacy & Data

- **Conversations are temporary** - Stored in memory for 30 minutes, then deleted
- **Bot restart clears all conversations** - No persistent storage
- **OpenAI processes messages** - Messages are sent to OpenAI's API
- **Permanent data** - Only Zwift ID links are stored permanently in Firebase

## Support

If you encounter issues:
1. Check the bot console logs for errors
2. Verify your `.env` configuration
3. Test with simple commands first
4. Check OpenAI API status at [status.openai.com](https://status.openai.com)

---

**Enjoy your AI-powered Discord bot!** 🤖🚴

