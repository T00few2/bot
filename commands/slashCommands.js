const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");

const commands = [
  // rider_stats
  new SlashCommandBuilder()
    .setName("rider_stats")
    .setDescription("Fetch single-rider stats by ZwiftID or Discord user mention")
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("The Zwift ID to check")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("Mention a Discord user to fetch their linked ZwiftID")
        .setRequired(false)
    ),
  // my_zwiftid (self-linking; direct or search-based)
  new SlashCommandBuilder()
    .setName("my_zwiftid")
    .setDescription("Link your Discord ID to a ZwiftID (direct or via search)")
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("Your Zwift ID")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters of your name in the club stats")
        .setRequired(false)
    ),
  // whoami
  new SlashCommandBuilder()
    .setName("whoami")
    .setDescription("Retrieve your linked ZwiftID"),
  // team_stats
  new SlashCommandBuilder()
    .setName("team_stats")
    .setDescription("Compare multiple riders' stats from today's club_stats data")
    .addUserOption(option =>
      option
        .setName("rider1")
        .setDescription("First Discord user to compare")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("rider2")
        .setDescription("Second Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider3")
        .setDescription("Third Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider4")
        .setDescription("Fourth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider5")
        .setDescription("Fifth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider6")
        .setDescription("Sixth Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider7")
        .setDescription("Seventh Discord user")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("rider8")
        .setDescription("Eighth Discord user")
        .setRequired(false)
    ),
  // browse_riders
  new SlashCommandBuilder()
    .setName("browse_riders")
    .setDescription("Browse riders in today's club_stats by first 3 letters")
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters of the rider's name")
        .setRequired(true)
    ),
  // set_zwiftid (for setting another user's linked ZwiftID)
  new SlashCommandBuilder()
    .setName("set_zwiftid")
    .setDescription("Set the ZwiftID for a specified Discord user (direct or via search)")
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("The Discord user to update")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("zwiftid")
        .setDescription("The ZwiftID to set")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("searchterm")
        .setDescription("First 3+ letters to search for the rider")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
    
  // get_zwiftid (for retrieving a user's linked ZwiftID)
  new SlashCommandBuilder()
    .setName("get_zwiftid")
    .setDescription("Get the linked ZwiftID for a specified Discord user")
    .addUserOption(option =>
      option
        .setName("discorduser")
        .setDescription("The Discord user to query")
        .setRequired(true)
    ),
  // event_results
  new SlashCommandBuilder()
    .setName("event_results")
    .setDescription("Get team results from events matching a search string")
    .addStringOption(option =>
      option
        .setName("search")
        .setDescription("Search string to match in event titles")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

module.exports = commands; 