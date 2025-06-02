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
    ),
  // test_welcome (admin only)
  new SlashCommandBuilder()
    .setName("test_welcome")
    .setDescription("Test the welcome message system (admin only)")
    .addUserOption(option =>
      option
        .setName("target_user")
        .setDescription("User to simulate welcome message for (optional, defaults to yourself)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  
  // Legacy self-role management commands (for backward compatibility)
  new SlashCommandBuilder()
    .setName("setup_roles")
    .setDescription("Setup the default role system for this server (admin only)")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel where the role selection panel will be posted")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName("add_selfrole")
    .setDescription("Add a role to the default role panel (admin only)")
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to add to self-selection")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("description")
        .setDescription("Description for this role (optional)")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription("Emoji for this role (optional)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName("remove_selfrole")
    .setDescription("Remove a role from the default role panel (admin only)")
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to remove from self-selection")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName("roles_panel")
    .setDescription("Create/update the default role selection panel (admin only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  // NEW: Multi-panel role management commands
  new SlashCommandBuilder()
    .setName("setup_panel")
    .setDescription("Setup a role panel for a specific channel (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Unique ID for this panel (e.g., 'basic', 'advanced', 'vip')")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel where this panel will be posted")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("Display name for this panel")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("description")
        .setDescription("Description for this panel")
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName("required_role")
        .setDescription("Role required to access this panel (optional)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("add_panel_role")
    .setDescription("Add a role to a specific panel (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Panel ID to add the role to")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to add")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("description")
        .setDescription("Description for this role")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription("Emoji for this role")
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName("requires_approval")
        .setDescription("Whether this role requires approval before being granted")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("team_captain")
        .setDescription("Team captain who can approve this role (if approval required)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("remove_panel_role")
    .setDescription("Remove a role from a specific panel (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Panel ID to remove the role from")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to remove")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("update_panel")
    .setDescription("Update/refresh a specific role panel (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Panel ID to update")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("list_panels")
    .setDescription("List all role panels in this server (admin only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("set_role_approval")
    .setDescription("Set approval requirement for a role in a panel (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Panel ID containing the role")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to modify")
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName("requires_approval")
        .setDescription("Whether this role requires approval")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("pending_approvals")
    .setDescription("View pending role approval requests (admin only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles),

  new SlashCommandBuilder()
    .setName("set_team_captain")
    .setDescription("Set or update the team captain for a role (admin only)")
    .addStringOption(option =>
      option
        .setName("panel_id")
        .setDescription("Panel ID containing the role")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The team role to assign a captain to")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("team_captain")
        .setDescription("The user who will be the team captain")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setup_approval_channel")
    .setDescription("Set the channel for role approval requests (admin only)")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel for role approval requests")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName("roles_help")
    .setDescription("Show the role system guide and instructions")
].map(cmd => cmd.toJSON());

module.exports = commands; 