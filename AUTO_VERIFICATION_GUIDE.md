# Auto-Verification System Guide

The Discord bot now includes an automatic role verification system that can assign a "verified member" role to users when they meet specific criteria.

## 🎯 Overview

The auto-verification system automatically assigns and removes a designated role based on configurable criteria such as:
- Having a linked ZwiftID
- Discord account age requirements
- Server boost status
- Having specific prerequisite roles

## 🚀 Setup Commands

### 1. Setup Verification System
```
/setup_verification verified_role:<@role> [require_zwiftid:true/false] [minimum_account_age_days:number] [require_server_boost:true/false]
```

**Parameters:**
- `verified_role` (required): The role to assign to verified members
- `require_zwiftid` (optional): Whether users need a linked ZwiftID (default: true)
- `minimum_account_age_days` (optional): Minimum Discord account age in days
- `require_server_boost` (optional): Whether users need to boost the server

**Example:**
```
/setup_verification verified_role:@Verified Member require_zwiftid:true minimum_account_age_days:7
```

This will:
- Set @Verified Member as the verification role
- Require users to have a linked ZwiftID
- Require Discord accounts to be at least 7 days old
- Automatically process verification for existing members

### 2. Check Verification Status
```
/verification_status [user:<@user>]
```

Shows verification status for yourself or another user, including:
- Overall verification status
- Individual criteria results
- Missing requirements

### 3. Process All Members
```
/process_verification
```

Manually processes verification for all server members. Useful for:
- After changing verification criteria
- Bulk verification updates
- Troubleshooting

### 4. Disable Verification
```
/disable_verification
```

Disables the auto-verification system. Note: Existing verified roles are not automatically removed.

## 🔄 How It Works

### Automatic Triggers
The verification system automatically checks users when:

1. **New members join** - Verification is checked immediately
2. **Roles are added/removed** - Triggers re-verification
3. **ZwiftID is linked** - Checks verification after linking via any method:
   - `/my_zwiftid` command
   - `/set_zwiftid` command (admin)
   - ZwiftID selection menus

### Verification Criteria

#### ZwiftID Requirement
- Checks if user has linked their Discord account to a ZwiftID
- Links are stored in Firebase and accessible via existing commands
- Most common verification requirement

#### Account Age
- Checks Discord account creation date
- Helps prevent spam/new account abuse
- Configurable threshold in days

#### Server Boost
- Checks if user is currently boosting the server
- Premium verification tier option

#### Required Roles (Future Extension)
- Can require users to have specific roles first
- Useful for staged verification processes

## 📊 Status Monitoring

### Admin Monitoring
- All verification actions are logged to console
- Shows role assignments and removals with reasons
- Background processing status updates

### User Feedback
- Users receive confirmation when roles are assigned/removed through commands
- Status command shows current verification state
- Clear indication of missing requirements

## 🎛️ Configuration Options

### Default Criteria
When setting up verification, these are the available criteria:

```javascript
{
  requiresZwiftId: true,              // Most common requirement
  requiresMinimumAccountAge: false,   // Optional account age check
  minimumAccountAgeDays: 0,           // Days threshold
  requiresServerBoost: false,         // Premium requirement
  requiresSpecificRoles: [],          // Future: Array of required role IDs
  requiresActivityThreshold: false    // Future: Activity-based verification
}
```

### Role Management
- Bot must have `Manage Roles` permission
- Verification role must be **below** the bot's highest role
- Bot will check and warn about role hierarchy issues

## 🔧 Troubleshooting

### Common Issues

**"I cannot manage this role"**
- Move the bot's role above the verification role in server settings
- Ensure bot has `Manage Roles` permission

**"Verification not working after ZwiftID link"**
- Check if verification is enabled with `/verification_status`
- Verify the ZwiftID actually linked successfully with `/whoami`
- Use `/process_verification` to manually trigger check

**"Role removed unexpectedly"**
- User may have lost required criteria (e.g., account too new, roles removed)
- Check specific requirements with `/verification_status`

### Reset Verification
To completely reset the verification system:
1. `/disable_verification`
2. Manually remove verification role from all members (if desired)
3. `/setup_verification` with new settings

## 🔄 Integration with Existing Systems

### ZwiftID Commands
The verification system integrates seamlessly with existing ZwiftID commands:
- `/my_zwiftid` - Triggers verification after self-linking
- `/set_zwiftid` - Triggers verification after admin linking
- ZwiftID search menus - Automatic verification after selection

### Role Management
- Works alongside existing role panels and self-role systems
- Verification role can be included in role panels for manual management
- Does not interfere with other role automation

### Member Events
- Integrates with welcome message system
- Processes new members automatically
- Monitors role changes for re-verification

## 💡 Best Practices

### Setup Recommendations
1. **Start Simple**: Begin with just ZwiftID requirement
2. **Test First**: Use `/verification_status` to test criteria
3. **Monitor Logs**: Watch console output during initial setup
4. **Inform Users**: Announce verification requirements to members

### Maintenance
- Regularly check verification status of key members
- Use `/process_verification` after major server changes
- Monitor role hierarchy when adding new roles

### Security
- Don't make verification role too permissive
- Consider account age requirements for sensitive servers
- Monitor for verification bypass attempts

## 🎯 Common Use Cases

### Basic ZwiftID Verification
```
/setup_verification verified_role:@Verified require_zwiftid:true
```
Perfect for cycling communities where ZwiftID linking is the primary verification method.

### Enhanced Security
```
/setup_verification verified_role:@Trusted Member require_zwiftid:true minimum_account_age_days:14 require_server_boost:false
```
Adds account age requirement to prevent new account spam.

### Premium Verification
```
/setup_verification verified_role:@VIP Member require_zwiftid:true require_server_boost:true
```
Special tier for server boosters with ZwiftID verification.

## 📈 Future Enhancements

The verification system is designed to be extensible. Planned features include:
- Activity-based verification (message/interaction thresholds)
- Multiple verification tiers
- Custom verification criteria
- Integration with external APIs
- Scheduled verification audits

## 🆘 Support

If you encounter issues with the verification system:
1. Check the troubleshooting section above
2. Use `/verification_status` to diagnose specific problems
3. Review console logs for error messages
4. Test with `/process_verification` for manual processing

The verification system is designed to be robust and self-healing, automatically correcting verification status as conditions change. 