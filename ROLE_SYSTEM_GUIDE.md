# Advanced Role System Guide

The DZR Discord bot includes a comprehensive multi-panel role system that allows users to assign and remove roles themselves across different channels with progressive access control.

## 🌟 What's New

The role system now supports **multiple panels** with **channel-specific access control**! You can create different role panels in different channels, each with their own requirements and role sets.

### Key Features

- **Multiple Role Panels**: Create different panels for different purposes
- **Progressive Access**: Require specific roles to access advanced panels
- **Channel-Specific**: Each panel lives in its own channel
- **Backward Compatible**: All existing setups continue to work
- **Interactive Management**: Beautiful embeds with role descriptions and emojis
- **Permission Validation**: Automatic checks for bot permissions and role hierarchy

## 🚀 Quick Start

### Option 1: Simple Setup (Single Panel)
```
/setup_roles channel:#role-selection
/add_selfrole role:@Member description:"Basic member access"
/roles_panel
```

### Option 2: Advanced Setup (Multiple Panels)
```
/setup_panel panel_id:basic channel:#general-roles name:"Basic Roles"
/add_panel_role panel_id:basic role:@Member description:"Basic access"
/update_panel panel_id:basic

/setup_panel panel_id:advanced channel:#advanced-zone name:"Advanced Roles" required_role:@Member
/add_panel_role panel_id:advanced role:@VIP description:"VIP access"
/update_panel panel_id:advanced
```

## 📋 Command Reference

### Basic Commands (Single Panel)

| Command | Description | Example |
|---------|-------------|---------|
| `/setup_roles` | Setup default role system | `/setup_roles channel:#roles` |
| `/add_selfrole` | Add role to default panel | `/add_selfrole role:@Member` |
| `/remove_selfrole` | Remove role from default panel | `/remove_selfrole role:@Member` |
| `/roles_panel` | Update default panel | `/roles_panel` |

### Advanced Commands (Multi-Panel)

| Command | Description | Example |
|---------|-------------|---------|
| `/setup_panel` | Create a new role panel | `/setup_panel panel_id:vip channel:#vip-zone name:"VIP Roles"` |
| `/add_panel_role` | Add role to specific panel | `/add_panel_role panel_id:vip role:@VIP` |
| `/remove_panel_role` | Remove role from specific panel | `/remove_panel_role panel_id:vip role:@VIP` |
| `/update_panel` | Refresh specific panel | `/update_panel panel_id:vip` |
| `/list_panels` | View all panels | `/list_panels` |

### General Commands

| Command | Description |
|---------|-------------|
| `/roles_help` | Show comprehensive guide |

## 🎯 Example Setups

### Gaming Community Setup

```bash
# Basic roles for everyone
/setup_panel panel_id:basic channel:#general-roles name:"Basic Roles" 
/add_panel_role panel_id:basic role:@Member description:"Basic member access" emoji:👤
/add_panel_role panel_id:basic role:@Gamer description:"Gaming enthusiast" emoji:🎮
/add_panel_role panel_id:basic role:@Artist description:"Creative artist" emoji:🎨
/update_panel panel_id:basic

# Gaming roles (requires Member role)
/setup_panel panel_id:gaming channel:#gaming-zone name:"Gaming Roles" required_role:@Member
/add_panel_role panel_id:gaming role:@Competitive description:"Competitive player" emoji:🏆
/add_panel_role panel_id:gaming role:@Streamer description:"Content creator" emoji:📺
/add_panel_role panel_id:gaming role:@Tournament-Host description:"Event organizer" emoji:🎯
/update_panel panel_id:gaming

# VIP roles (requires Competitive or Streamer)
/setup_panel panel_id:vip channel:#vip-lounge name:"VIP Roles" required_role:@Competitive
/add_panel_role panel_id:vip role:@VIP description:"VIP member" emoji:💎
/add_panel_role panel_id:vip role:@Beta-Tester description:"Test new features" emoji:🧪
/update_panel panel_id:vip
```

### Development Community Setup

```bash
# Basic developer roles
/setup_panel panel_id:dev-basic channel:#dev-roles name:"Developer Roles"
/add_panel_role panel_id:dev-basic role:@Developer description:"Software developer" emoji:💻
/add_panel_role panel_id:dev-basic role:@Designer description:"UI/UX designer" emoji:🎨
/add_panel_role panel_id:dev-basic role:@DevOps description:"DevOps engineer" emoji:⚙️
/update_panel panel_id:dev-basic

# Senior roles (requires Developer)
/setup_panel panel_id:senior channel:#senior-dev name:"Senior Roles" required_role:@Developer
/add_panel_role panel_id:senior role:@Senior-Dev description:"Senior developer" emoji:🚀
/add_panel_role panel_id:senior role:@Tech-Lead description:"Technical leadership" emoji:👑
/add_panel_role panel_id:senior role:@Mentor description:"Mentoring role" emoji:🎓
/update_panel panel_id:senior

# Leadership (requires Senior-Dev)
/setup_panel panel_id:leadership channel:#leadership name:"Leadership" required_role:@Senior-Dev
/add_panel_role panel_id:leadership role:@Project-Manager description:"Project management" emoji:📋
/add_panel_role panel_id:leadership role:@CTO description:"Chief Technology Officer" emoji:👔
/update_panel panel_id:leadership
```

## 🎭 User Experience

### For Regular Users

1. **Find Role Panels**: Look for role selection messages in various channels
2. **Check Requirements**: Some panels may require specific roles first
3. **Click Buttons**: Click any role button to add or remove that role
4. **Progressive Access**: Get basic roles to unlock access to advanced panels
5. **Get Feedback**: Receive confirmation messages for each action

### Access Flow Example

1. **Start in #general-roles**: Get @Member role
2. **Unlock #gaming-zone**: Now accessible with @Member role
3. **Get @Competitive**: Become a competitive player
4. **Unlock #vip-lounge**: Access exclusive VIP roles

## 🔧 Setup Instructions

### 1. Plan Your Structure

Before setting up, plan your role hierarchy:

- **What roles do you want?** (Member, VIP, Moderator, etc.)
- **What channels will host panels?** (Make sure bot has access)
- **What are the requirements?** (Which roles unlock which panels?)

### 2. Create Channels

Set up channels with appropriate permissions:

```
#general-roles     - @everyone can view
#member-zone       - Only @Member can view  
#vip-lounge        - Only @VIP can view
```

### 3. Setup Panels

Create panels in order of access level:

```bash
# Start with basic (no requirements)
/setup_panel panel_id:basic channel:#general-roles name:"Basic Roles"

# Then intermediate (requires basic roles)
/setup_panel panel_id:member channel:#member-zone name:"Member Roles" required_role:@Member

# Finally advanced (requires intermediate roles)
/setup_panel panel_id:vip channel:#vip-lounge name:"VIP Roles" required_role:@VIP
```

### 4. Add Roles

Add roles to each panel:

```bash
/add_panel_role panel_id:basic role:@Member description:"Basic access"
/add_panel_role panel_id:member role:@VIP description:"VIP access"
/add_panel_role panel_id:vip role:@Beta-Tester description:"Beta testing"
```

### 5. Deploy Panels

Activate each panel:

```bash
/update_panel panel_id:basic
/update_panel panel_id:member
/update_panel panel_id:vip
```

## 🛡️ Permissions & Security

### Bot Permissions Required

**Server-wide:**
- `Manage Roles` - To assign/remove roles
- `Send Messages` - To send panels
- `Embed Links` - To create rich embeds
- `Use Slash Commands` - For admin commands

**Per Channel:**
- `View Channel` - To see the channel
- `Send Messages` - To post panels
- `Embed Links` - To create embeds

### Role Hierarchy Rules

- Bot's role must be **higher** than managed roles
- Cannot manage `@everyone` role
- Cannot manage bot/integration roles
- Roles are validated before adding to panels

### Access Control

- **Panel Requirements**: Users need specific roles to access panels
- **Progressive System**: Natural progression through role tiers
- **Channel Permissions**: Discord's native permission system controls channel access
- **Safe Validation**: All permissions checked before role assignment

## 📊 Management & Monitoring

### View All Panels

```bash
/list_panels
```

This shows:
- Panel names and IDs
- Channel locations
- Number of roles
- Required roles
- Deployment status

### Panel Status Indicators

- ✅ **Active**: Panel is deployed and working
- ⚠️ **Not deployed**: Panel exists but needs `/update_panel`
- 🔒 **Requires roles**: Panel has access requirements
- ❌ **Error**: Channel or roles not found

## 🔄 Migration from Old System

If you have an existing single-panel setup:

1. **Your current setup continues to work** - No action needed
2. **To upgrade**: Use new `/setup_panel` commands alongside existing setup
3. **To migrate**: Export roles, create new panels, import roles, deprecate old panel

### Migration Example

```bash
# Your old setup still works
/roles_panel  # Updates your existing default panel

# Add new advanced panels
/setup_panel panel_id:advanced channel:#advanced-zone name:"Advanced Roles" required_role:@Member
/add_panel_role panel_id:advanced role:@VIP description:"VIP access"
/update_panel panel_id:advanced
```

## ❓ Troubleshooting

### Common Issues

**"Panel not found"**
- Check panel ID spelling with `/list_panels`
- Ensure panel was created with `/setup_panel`

**"You need the following roles"**
- Get required roles from earlier panels first
- Check panel requirements with `/list_panels`

**"I cannot manage this role"**
- Ensure bot's role is higher than target role
- Check role isn't managed by another bot

**"I don't have permission to send messages"**
- Verify bot has permissions in target channel
- Check channel permissions for the bot

**Role buttons not working**
- Ensure bot has `Manage Roles` permission
- Verify role hierarchy is correct
- Check if role still exists

### Getting Help

1. **Check `/list_panels`** - See all panel configurations
2. **Verify permissions** - Ensure bot has required permissions
3. **Check role hierarchy** - Bot role must be higher than managed roles
4. **Review channel access** - Ensure bot can access panel channels
5. **Test with `/roles_help`** - Get comprehensive guidance

## 🚀 Advanced Features

### Multiple Required Roles

Currently supports one required role per panel. For complex requirements, create intermediate roles:

```bash
# Instead of requiring both @Developer AND @Senior
# Create @Senior-Developer role that requires @Developer first
```

### Role Categories

Organize roles by creating themed panels:

```bash
/setup_panel panel_id:gaming channel:#gaming name:"Gaming Roles"
/setup_panel panel_id:creative channel:#creative name:"Creative Roles"  
/setup_panel panel_id:tech channel:#tech name:"Tech Roles"
```

### Temporary Access

Use Discord's native timeout features alongside role panels for temporary access control.

## 📈 Best Practices

1. **Start Simple**: Begin with basic panels, add complexity gradually
2. **Clear Naming**: Use descriptive panel IDs and names
3. **Logical Progression**: Create natural role progression paths
4. **Test Thoroughly**: Test each panel after creation
5. **Document Structure**: Keep track of your role hierarchy
6. **Regular Maintenance**: Periodically review and update panels
7. **User Education**: Help users understand the progression system

## 🔮 Future Enhancements

Potential additions being considered:

- **Multiple Required Roles**: AND/OR logic for requirements
- **Time-Based Roles**: Roles that expire automatically
- **Role Limits**: Maximum number of roles per user
- **Analytics Dashboard**: Track role assignment statistics
- **Web Interface**: Browser-based panel management
- **Role Templates**: Pre-built role structures for common use cases

---

*This guide covers the advanced multi-panel role system. For basic usage, the simple commands (`/setup_roles`, `/add_selfrole`, `/roles_panel`) continue to work as before.* 