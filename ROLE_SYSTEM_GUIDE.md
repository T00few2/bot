# Self-Role System Guide

The DZR Discord bot includes a comprehensive self-role system that allows users to assign and remove roles themselves in a dedicated channel.

## Features

- **Interactive Role Selection**: Users can click buttons to add/remove roles
- **Admin Management**: Full control over which roles are available
- **Visual Interface**: Beautiful embed with role descriptions and emojis
- **Permission Checks**: Automatic validation of bot permissions and role hierarchy
- **Persistent Storage**: Configuration stored in Firebase

## Setup Instructions

### 1. Initial Setup

First, set up the role system for your server:

```
/setup_roles channel:#role-selection
```

This command:
- Creates the role system configuration for your server
- Sets the designated channel where the role panel will appear
- Validates bot permissions in the channel

### 2. Add Roles to Selection

Add roles that users can self-assign:

```
/add_selfrole role:@RoleName description:"Role description" emoji:🎮
```

Parameters:
- `role`: The role to add (required)
- `description`: Optional description shown in the panel
- `emoji`: Optional emoji for the button (Unicode or custom)

Example:
```
/add_selfrole role:@Gamer description:"For gaming enthusiasts" emoji:🎮
/add_selfrole role:@Developer description:"Software developers" emoji:💻
/add_selfrole role:@Artist description:"Creative artists" emoji:🎨
```

### 3. Create the Role Panel

Generate the interactive role selection panel:

```
/roles_panel
```

This command:
- Creates a beautiful embed with all available roles
- Adds interactive buttons for each role
- Updates the panel if it already exists
- Deletes the old panel when creating a new one

### 4. Remove Roles (Optional)

Remove roles from the selection list:

```
/remove_selfrole role:@RoleName
```

## User Experience

Once set up, users can:

1. **View Available Roles**: See all self-assignable roles in the embed
2. **Add Roles**: Click a button to get a role (if they don't have it)
3. **Remove Roles**: Click the same button to remove a role (if they have it)
4. **Get Feedback**: Receive confirmation messages for each action

## Bot Permissions Required

The bot needs these permissions:

### Server-wide:
- `Manage Roles` - To assign/remove roles
- `Send Messages` - To send the role panel
- `Embed Links` - To create rich embeds
- `Use Slash Commands` - For admin commands

### In the Role Channel:
- `View Channel` - To see the channel
- `Send Messages` - To post the role panel
- `Embed Links` - To create the embed

### Role Hierarchy:
- The bot's role must be **higher** than any roles it manages
- Managed roles (bot roles, integration roles) cannot be added to self-selection

## Admin Commands Reference

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/setup_roles` | Initialize the role system | Administrator |
| `/add_selfrole` | Add a role to self-selection | Administrator |
| `/remove_selfrole` | Remove a role from self-selection | Administrator |
| `/roles_panel` | Create/update the role panel | Administrator |

## Troubleshooting

### "I cannot manage this role"
- Ensure the bot's role is higher than the role you're trying to add
- Check that the role isn't managed by another bot/integration

### "I don't have permission to send messages"
- Verify the bot has Send Messages permission in the target channel
- Check that the bot can view the channel

### "Role system not setup"
- Run `/setup_roles` first to initialize the system
- Ensure you're running commands in the correct server

### Role buttons not working
- Check that the bot has Manage Roles permission
- Verify the bot's role hierarchy
- Ensure the role still exists and isn't managed

## Technical Details

### Data Storage
Role configurations are stored in Firebase Firestore under the `selfRoles` collection:

```json
{
  "guildId": {
    "channelId": "123456789",
    "roles": [
      {
        "roleId": "987654321",
        "roleName": "Gamer",
        "description": "For gaming enthusiasts",
        "emoji": "🎮",
        "addedAt": "timestamp"
      }
    ],
    "panelMessageId": "111222333",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### Button Limitations
- Maximum 25 roles per panel (5 rows × 5 buttons)
- For more roles, consider creating multiple panels or using categories

### Security Features
- Only administrators can manage the role system
- Automatic validation of role permissions
- Prevention of @everyone role assignment
- Managed role detection and blocking

## Future Enhancements

Potential additions to consider:

1. **Web Dashboard**: Browser-based role management interface
2. **Role Categories**: Group roles into different categories
3. **Temporary Roles**: Roles that expire after a set time
4. **Role Requirements**: Prerequisite roles or conditions
5. **Usage Analytics**: Track role assignment statistics
6. **Multiple Panels**: Different role panels for different purposes

## Support

If you encounter issues:

1. Check the bot's permissions and role hierarchy
2. Verify the role system is properly set up
3. Review the troubleshooting section above
4. Check the bot's console logs for error messages 