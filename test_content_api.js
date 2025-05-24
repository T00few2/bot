require("dotenv").config();
const { getWelcomeMessage, getDueScheduledMessages } = require("./services/contentApi");

async function testContentAPI() {
  console.log("🧪 Testing Content API Integration...\n");
  
  // Test 1: Get welcome messages
  console.log("1. Testing welcome messages...");
  try {
    const welcomeMessage = await getWelcomeMessage();
    if (welcomeMessage) {
      console.log("✅ Successfully retrieved welcome message:");
      console.log(`   Title: ${welcomeMessage.title}`);
      console.log(`   Content: ${welcomeMessage.content}`);
      console.log(`   Active: ${welcomeMessage.active}`);
      console.log(`   Has Embed: ${welcomeMessage.embed ? 'Yes' : 'No'}\n`);
    } else {
      console.log("ℹ️  No welcome messages found (create one via web interface)\n");
    }
  } catch (error) {
    console.log("❌ Error getting welcome messages:", error.message);
    console.log("   Check your CONTENT_API_BASE_URL and CONTENT_API_KEY\n");
  }
  
  // Test 2: Get scheduled messages
  console.log("2. Testing scheduled messages...");
  try {
    const dueMessages = await getDueScheduledMessages();
    console.log(`✅ Successfully checked scheduled messages: ${dueMessages.length} due now`);
    if (dueMessages.length > 0) {
      dueMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.title} -> Channel: ${msg.channel_id}`);
      });
    }
    console.log();
  } catch (error) {
    console.log("❌ Error getting scheduled messages:", error.message);
    console.log("   Check your API configuration\n");
  }
  
  // Test 3: Check configuration
  console.log("3. Configuration check...");
  console.log(`   API Base URL: ${process.env.CONTENT_API_BASE_URL || 'NOT SET'}`);
  console.log(`   API Key: ${process.env.CONTENT_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   Welcome Channel: ${process.env.DISCORD_WELCOME_CHANNEL_ID || 'NOT SET (will use system channel)'}`);
  
  console.log("\n🏁 Test complete!");
}

testContentAPI().catch(console.error); 