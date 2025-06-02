# Role Approval System Guide

## Overview

The Role Approval System extends your existing role service to support approval workflows for certain roles. When users click on roles that require approval, the bot will send a message to a designated approval channel where admins can approve or deny the request by reacting with ✅.

## Features

- **Selective Approval**: Only specific roles require approval, others work instantly
- **Visual Indicators**: Roles requiring approval show a 🔐 icon in panels
- **Approval Channel**: Dedicated channel for approval requests
- **Admin Control**: Only admins and users with "Manage Roles" permission can approve
- **Automatic Processing**: Approved roles are automatically assigned
- **Request Tracking**: All approval requests are stored in Firebase
- **Status Updates**: Approval messages update to show approval status

## Setup Instructions

### 1. Environment Configuration

Add the approval channel ID to your environment variables (optional but recommended):

```env
DISCORD_APPROVAL_CHANNEL_ID=your_approval_channel_id_here
```

If not set, the bot will automatically find a channel with "approval" in the name.

### 2. Create an Approval Channel

Create a dedicated channel for approval requests:

```
/setup_approval_channel channel:#role-approvals
```

This channel should be:
- Visible to admins and moderators
- Not visible to regular users (to avoid spam)
- Have the bot with proper permissions

### 3. Add Roles with Approval Requirements

When adding roles to panels, use the `requires_approval` parameter:

```
/add_panel_role panel_id:vip role:@VIP description:"VIP access" requires_approval:true
```

Or update existing roles:

```
/set_role_approval panel_id:vip role:@VIP requires_approval:true
```

### 4. Update Your Panels

After adding approval requirements, refresh your panels:

```
/update_panel panel_id:vip
```

## Usage Workflow

### For Users

1. **Click Role Button**: User clicks on a role button in a panel
2. **Approval Request**: If the role requires approval, a request is submitted
3. **Notification**: User receives a message that their request is pending approval
4. **Automatic Assignment**: Once approved, the role is automatically assigned

### For Admins

1. **Approval Message**: Bot posts approval request in the approval channel
2. **Review Request**: Admin reviews the user and role information
3. **Approve**: Admin reacts with ✅ to approve the request
4. **Automatic Processing**: Bot assigns the role and updates the message

## Commands Reference

### Setup Commands

- `/setup_approval_channel channel:#channel` - Set the approval channel
- `/pending_approvals` - View all pending approval requests

### Role Management Commands

- `/add_panel_role panel_id:id role:@role requires_approval:true` - Add role with approval
- `/set_role_approval panel_id:id role:@role requires_approval:true` - Update approval requirement
- `/update_panel panel_id:id` - Refresh panel to show approval indicators

### Monitoring Commands

- `/pending_approvals` - List all pending requests
- `/list_panels` - View all panels and their configurations

## Visual Indicators

### In Role Panels

- **🔐 Icon**: Appears next to roles that require approval
- **Approval Section**: Lists all roles requiring approval
- **Status Messages**: Clear feedback when requesting approval

### In Approval Channel

- **Rich Embeds**: Detailed information about each request
- **User Information**: Avatar, username, and display name
- **Role Information**: Role mention and panel context
- **Timestamps**: When the request was made
- **Status Updates**: Visual confirmation when approved

## Permissions Required

### Bot Permissions

The bot needs these permissions in the approval channel:
- **View Channel**
- **Send Messages**
- **Embed Links**
- **Add Reactions**
- **Manage Messages** (to update approval status)

### Admin Permissions

Users who can approve requests need:
- **Administrator** permission, OR
- **Manage Roles** permission

## Database Structure

### Role Approvals Collection

```javascript
{
  guildId: "server_id",
  userId: "user_id", 
  roleId: "role_id",
  roleName: "Role Name",
  panelId: "panel_id",
  panelName: "Panel Name",
  status: "pending|approved|denied",
  requestedAt: Date,
  approvedBy: "approver_user_id",
  approvedAt: Date,
  approvalMessageId: "message_id",
  approvalChannelId: "channel_id"
}
```

### Role Panel Structure (Updated)

```javascript
{
  roles: [
    {
      roleId: "role_id",
      roleName: "Role Name", 
      description: "Role description",
      emoji: "🎭",
      requiresApproval: true, // NEW FIELD
      addedAt: Date
    }
  ]
}
```

## Example Setup Workflow

### 1. Basic Setup

```bash
# Create approval channel
/setup_approval_channel channel:#role-approvals

# Create a VIP panel
/setup_panel panel_id:vip channel:#vip-zone name:"VIP Roles" required_role:@Member
```

### 2. Add Roles with Different Requirements

```bash
# Regular role (instant)
/add_panel_role panel_id:vip role:@Supporter description:"Support the server" requires_approval:false

# Premium role (requires approval)
/add_panel_role panel_id:vip role:@VIP description:"VIP access" requires_approval:true

# Admin role (requires approval)
/add_panel_role panel_id:vip role:@Moderator description:"Moderation access" requires_approval:true
```

### 3. Deploy and Test

```bash
# Deploy the panel
/update_panel panel_id:vip

# Check pending requests
/pending_approvals

# View all panels
/list_panels
```

## Troubleshooting

### Common Issues

1. **Approval messages not appearing**
   - Check bot permissions in approval channel
   - Verify approval channel is set correctly
   - Ensure bot can add reactions

2. **Approvals not working**
   - Verify admin has "Manage Roles" or "Administrator" permission
   - Check if bot role is higher than the role being assigned
   - Ensure the approval message hasn't been deleted

3. **Role not assigned after approval**
   - Check bot's role hierarchy
   - Verify the role still exists
   - Check bot permissions in the server

### Debug Commands

```bash
# Check panel configuration
/list_panels

# View pending requests
/pending_approvals

# Test with a simple role first
/add_panel_role panel_id:test role:@TestRole requires_approval:true
```

## Best Practices

### Channel Setup

- Create a private approval channel visible only to staff
- Use clear channel names like `#role-approvals` or `#staff-approvals`
- Set appropriate permissions to prevent user access

### Role Configuration

- Start with a few approval roles to test the system
- Use approval for sensitive roles (Admin, Moderator, VIP)
- Keep instant roles for basic access (Member, Verified)

### Approval Process

- Respond to approval requests promptly
- Consider the user's history and behavior
- Use the approval system for quality control

### Monitoring

- Regularly check pending approvals
- Clean up old approval messages
- Monitor for abuse or spam requests

## Security Considerations

- Only trusted users should have approval permissions
- Approval channel should be staff-only
- Monitor approval patterns for abuse
- Consider rate limiting for frequent requests
- Regular audit of approved roles and users

## Integration with Existing System

The approval system is fully backward compatible:

- **Existing panels**: Continue to work without changes
- **Legacy commands**: Still function as before  
- **Database**: Existing data is preserved
- **Permissions**: No changes to existing role assignments

New features are additive and optional, allowing gradual adoption of the approval workflow. 