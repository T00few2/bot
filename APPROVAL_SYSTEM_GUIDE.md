# Team Captain Approval System Guide

## Overview

The Team Captain Approval System extends your Discord role service to support team-based approval workflows, perfect for Zwift racing communities. When riders click on team roles that require approval, the bot will send a join request to a designated approval channel where team captains (or admins) can approve new team members by reacting with ✅.

## Features

### 🏁 Perfect for Zwift Racing Teams
- **Team-Specific Captains**: Each team role can have its own designated captain
- **Rider Join Requests**: Themed for cycling/racing communities
- **Flexible Approval**: Team captains OR admins can approve requests
- **Visual Team Indicators**: 🔐 icon shows team roles requiring captain approval

### 🔧 Technical Features
- **Selective Approval**: Only specific roles require approval, others work instantly
- **Smart Mentions**: Team captains get mentioned for their specific teams
- **Approval Channel**: Dedicated channel for join requests
- **Automatic Processing**: Approved roles are automatically assigned
- **Request Tracking**: All approval requests stored in Firebase
- **Status Updates**: Approval messages update to show approval status

## Setup Instructions

### 1. Environment Configuration

Add the approval channel ID to your environment variables (optional but recommended):

```env
DISCORD_APPROVAL_CHANNEL_ID=your_approval_channel_id_here
```

If not set, the bot will automatically find a channel with "approval" in the name.

### 2. Create a Team Approval Channel

Create a dedicated channel for team join requests:

```
/setup_approval_channel channel:#team-approvals
```

This channel should be:
- Visible to team captains and admins
- Not visible to regular riders (to avoid spam)
- Have the bot with proper permissions

### 3. Set Up Team Roles with Captains

When adding team roles to panels, specify the team captain:

```
/add_panel_role panel_id:teams role:@TeamA description:"Team A Riders" emoji:🔴 requires_approval:true team_captain:@CaptainA
```

Or assign team captains to existing roles:

```
/set_team_captain panel_id:teams role:@TeamA team_captain:@CaptainA
```

### 4. Update Your Panels

After adding team captain assignments, refresh your panels:

```
/update_panel panel_id:teams
```

## Usage Workflow

### For Riders

1. **Browse Teams**: Rider views available teams in the role panel
2. **Request to Join**: Rider clicks on a team role button (🔐 indicates approval required)
3. **Join Request Submitted**: Bot confirms the request has been submitted
4. **Wait for Approval**: Team captain gets notified to review the request
5. **Welcome to the Team**: Once approved, the role is automatically assigned

### For Team Captains

1. **Join Request**: Bot posts join request in the approval channel with captain mention
2. **Review Rider**: Captain reviews the rider's information and request
3. **Approve**: Captain reacts with ✅ to approve the rider for their team
4. **Automatic Processing**: Bot assigns the role and updates the message
5. **Team Management**: Use `/pending_approvals` to monitor requests

### For Admins

- **Backup Approval**: Admins can approve any team join request as backup
- **System Management**: Set up panels, assign captains, monitor system
- **Override Authority**: Admin permissions work for all teams

## Commands Reference

### Setup Commands

- `/setup_approval_channel channel:#channel` - Set the team approval channel
- `/setup_panel panel_id:teams channel:#channel name:"Racing Teams"` - Create team panel

### Team Management Commands

- `/add_panel_role panel_id:teams role:@TeamA team_captain:@CaptainA requires_approval:true` - Add team with captain
- `/set_team_captain panel_id:teams role:@TeamA team_captain:@CaptainA` - Assign/update team captain
- `/set_role_approval panel_id:teams role:@TeamA requires_approval:true` - Toggle approval requirement
- `/update_panel panel_id:teams` - Refresh panel to show team captain info

### Monitoring Commands

- `/pending_approvals` - List all pending team join requests
- `/list_panels` - View all panels and their team configurations

## Example Zwift Racing Setup

### 1. Basic Rider Roles (Instant Assignment)

```bash
# Create basic rider panel
/setup_panel panel_id:basic channel:#roles name:"Rider Roles"
/add_panel_role panel_id:basic role:@Verified description:"Verified Zwift rider" emoji:✅
/add_panel_role panel_id:basic role:@Zwifter description:"Community member" emoji:🚴‍♂️
/update_panel panel_id:basic
```

### 2. Racing Teams (Captain Approval Required)

```bash
# Create team approval channel
/setup_approval_channel channel:#team-approvals

# Create racing teams panel
/setup_panel panel_id:teams channel:#team-selection name:"Racing Teams" required_role:@Verified

# Add teams with captains
/add_panel_role panel_id:teams role:@TeamVelocity description:"Sprint specialists" emoji:🔴 requires_approval:true team_captain:@CaptainVelocity
/add_panel_role panel_id:teams role:@TeamEndurance description:"Long distance riders" emoji:🔵 requires_approval:true team_captain:@CaptainEndurance  
/add_panel_role panel_id:teams role:@TeamClimbers description:"Hill climb experts" emoji:🟢 requires_approval:true team_captain:@CaptainClimbers

# Deploy the team panel
/update_panel panel_id:teams
```

### 3. Admin/Moderator Roles (Admin-Only Approval)

```bash
# Create staff panel
/setup_panel panel_id:staff channel:#staff-zone name:"Staff Roles" required_role:@TeamCaptain

# Add staff roles (no specific captain, admin-only approval)
/add_panel_role panel_id:staff role:@Moderator description:"Community moderation" emoji:🛡️ requires_approval:true
/add_panel_role panel_id:staff role:@EventOrganizer description:"Race event management" emoji:📅 requires_approval:true

/update_panel panel_id:staff
```

## Visual Indicators

### In Role Panels

- **🔐 Icon**: Appears next to roles that require team captain approval
- **Team Captain Section**: Shows which captain approves each team
- **Approval Required**: Lists all teams requiring approval
- **Clear Status**: Feedback messages when requesting to join

Example panel display:
```
🏆 Available Teams
🔴 @TeamVelocity - Sprint specialists 🔐
🔵 @TeamEndurance - Long distance riders 🔐
🟢 @TeamClimbers - Hill climb experts 🔐

🔐 Approval Required
The following roles require approval: @TeamVelocity, @TeamEndurance, @TeamClimbers

Team Captains:
• @TeamVelocity → @CaptainVelocity
• @TeamEndurance → @CaptainEndurance  
• @TeamClimbers → @CaptainClimbers
```

### In Approval Channel

- **Rich Embeds**: Detailed rider information with avatar
- **Team Context**: Clear team role and panel information
- **Captain Mentions**: Specific team captain gets mentioned
- **Timestamps**: When the join request was made
- **Approval Instructions**: Clear instructions for captains
- **Status Updates**: Visual confirmation when approved

Example approval message:
```
🏁 Team Join Request
A rider wants to join a team!

🚴 Rider: JohnRider (john#1234)
🏆 Team Role: @TeamVelocity  
📋 Panel: Racing Teams
👨‍✈️ Team Captain: @CaptainVelocity
🕐 Requested At: 2 minutes ago

✅ How to Approve
@CaptainVelocity React with ✅ to approve this rider for your team!

*Admins can also approve this request.*
```

## Permissions and Access Control

### Who Can Approve Join Requests

1. **Team Captains**: Can approve requests for their specific teams only
2. **Administrators**: Can approve any request (backup authority)
3. **Manage Roles Permission**: Users with this permission can approve any request

### Bot Permissions Required

The bot needs these permissions in the approval channel:
- **View Channel**
- **Send Messages**
- **Embed Links**
- **Add Reactions**
- **Manage Messages** (to update approval status)

### Channel Access Recommendations

- **Approval Channel**: Team captains + staff access
- **Team Panels**: Public or role-restricted (e.g., verified riders only)
- **Basic Role Panels**: Public access

## Database Structure

### Role Approvals Collection (Updated)

```javascript
{
  guildId: "server_id",
  userId: "user_id", 
  roleId: "role_id",
  roleName: "Team Name",
  panelId: "panel_id",
  panelName: "Racing Teams",
  teamCaptainId: "captain_user_id", // NEW FIELD
  status: "pending|approved|denied",
  requestedAt: Date,
  approvedBy: "approver_user_id",
  approvedAt: Date,
  approverType: "Team Captain|Admin", // NEW FIELD
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
      roleName: "Team Name", 
      description: "Team description",
      emoji: "🔴",
      requiresApproval: true,
      teamCaptainId: "captain_user_id", // NEW FIELD
      addedAt: Date
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Team captain not getting mentioned**
   - Verify team captain is set: `/list_panels`
   - Check if captain is still in the server
   - Ensure captain has access to approval channel

2. **Captain can't approve requests**
   - Verify captain is assigned to the correct team role
   - Check if the team captain user is still valid
   - Ensure they're reacting to the correct message

3. **Approval messages not appearing**
   - Check bot permissions in approval channel
   - Verify approval channel is set correctly
   - Ensure bot can add reactions and send embeds

4. **Wrong person trying to approve**
   - Only team captains can approve their specific teams
   - Admins can approve any request
   - Users get DM if they don't have permission

### Debug Commands

```bash
# Check all panel configurations
/list_panels

# View pending team join requests
/pending_approvals

# Test the system
/add_panel_role panel_id:test role:@TestTeam requires_approval:true team_captain:@TestCaptain
```

## Best Practices

### Team Captain Selection

- Choose active, trusted community members
- Ensure captains understand their role
- Regularly review captain assignments
- Have backup captains for large teams

### Channel Organization

- Use clear channel names like `#team-approvals` or `#join-requests`
- Keep approval channel visible to captains but not regular riders
- Set appropriate permissions to prevent spam

### Team Management

- Start with a few teams to test the system
- Use approval for competitive teams
- Keep casual/social roles instant assignment
- Monitor join request patterns

### Communication

- Set clear expectations for team membership
- Document team requirements and expectations
- Provide guidance to team captains on approval criteria
- Regular communication about the approval process

## Security Considerations

- **Captain Authority**: Team captains can only approve their assigned teams
- **Admin Oversight**: Admins retain override authority for all approvals
- **Permission Validation**: Bot validates permissions before processing approvals
- **Audit Trail**: All approvals are logged with approver information
- **Access Control**: Approval channel should be restricted appropriately

## Integration with Existing System

The team captain approval system is fully backward compatible:

- **Existing Panels**: Continue to work without changes
- **Legacy Commands**: Still function as before  
- **Database**: Existing data is preserved
- **Instant Roles**: Non-approval roles work exactly as before

New team captain features are additive and optional:

- **Gradual Adoption**: Add team captains to roles one at a time
- **Mixed Panels**: Combine instant and approval roles in the same panel
- **Flexible Assignment**: Roles can have team captains, admin-only approval, or instant assignment

## Advanced Usage

### Multiple Team Captains

While the system supports one captain per team role, you can create multiple team roles for the same team:

```bash
# Team A with different specializations
/add_panel_role panel_id:teams role:@TeamA-Sprinters team_captain:@CaptainSprint requires_approval:true
/add_panel_role panel_id:teams role:@TeamA-Climbers team_captain:@CaptainClimb requires_approval:true
```

### Seasonal Team Changes

Update team captains for new seasons:

```bash
# Update captain for new season
/set_team_captain panel_id:teams role:@TeamVelocity team_captain:@NewCaptainVelocity
/update_panel panel_id:teams
```

### Team Hierarchies

Create progression paths through teams:

```bash
# Beginner teams (instant)
/add_panel_role panel_id:beginner role:@CasualRiders requires_approval:false

# Competitive teams (captain approval)
/add_panel_role panel_id:competitive role:@ProTeam team_captain:@ProCaptain requires_approval:true
```

This system provides the perfect foundation for managing Zwift racing teams with appropriate oversight and community involvement! 