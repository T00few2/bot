const MEMBER_ROLE_ID = "1195878123795910736";
const NEW_MEMBER_ROLE_ID = "1410492230002671736";
const WINDOW_DAYS = 14;

function isWithinWindow(joinedTimestamp, windowDays = WINDOW_DAYS) {
  if (!joinedTimestamp) return false;
  const now = Date.now();
  const threshold = now - windowDays * 24 * 60 * 60 * 1000;
  return joinedTimestamp >= threshold;
}

async function ensureNewMemberRole(member) {
  try {
    const hasMember = member.roles.cache.has(MEMBER_ROLE_ID);
    const hasNewMember = member.roles.cache.has(NEW_MEMBER_ROLE_ID);
    const inWindow = isWithinWindow(member.joinedTimestamp);

    if (hasMember && inWindow && !hasNewMember) {
      await member.roles.add(NEW_MEMBER_ROLE_ID);
      console.log(`✅ Added New Member role to ${member.user.username}`);
      return { changed: true, action: "added" };
    }

    if ((
      !hasMember || !inWindow
    ) && hasNewMember) {
      await member.roles.remove(NEW_MEMBER_ROLE_ID);
      console.log(`❌ Removed New Member role from ${member.user.username}`);
      return { changed: true, action: "removed" };
    }

    return { changed: false };
  } catch (error) {
    console.error("Error ensuring New Member role:", error);
    return { changed: false, error: error.message };
  }
}

async function sweepGuildForNewMembers(guild) {
  try {
    // Ensure cache populated
    await guild.members.fetch();
    let added = 0;
    let removed = 0;

    for (const member of guild.members.cache.values()) {
      const result = await ensureNewMemberRole(member);
      if (result?.action === "added") added++;
      if (result?.action === "removed") removed++;
    }

    console.log(`🔍 New Member sweep: +${added} added, -${removed} removed in ${guild.name}`);
    return { added, removed };
  } catch (error) {
    console.error("Error sweeping guild for new members:", error);
    return { added: 0, removed: 0, error: error.message };
  }
}

module.exports = {
  ensureNewMemberRole,
  sweepGuildForNewMembers,
  MEMBER_ROLE_ID,
  NEW_MEMBER_ROLE_ID,
  WINDOW_DAYS,
};


