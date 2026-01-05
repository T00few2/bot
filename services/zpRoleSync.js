const config = require("../config/config");
const { getLatestClubStats, getAllLinkedUsers } = require("./firebase");

function normalizeId(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  return String(v).trim() || null;
}

function normalizeZpCategory(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  if (!s) return null;
  // ZP categories are typically: D/C/B/A/A+
  if (s === "A+") return "A+";
  if (s === "A" || s === "B" || s === "C" || s === "D") return s;
  return null;
}

function roleIdForCategory(cat) {
  // A and A+ share a single Discord role ("A/A+") in your requirement
  if (cat === "A" || cat === "A+") return config.zpRoles.A;
  if (cat === "B") return config.zpRoles.B;
  if (cat === "C") return config.zpRoles.C;
  if (cat === "D") return config.zpRoles.D;
  return null;
}

async function syncZpRolesForGuild(guild) {
  const latest = await getLatestClubStats();
  if (!latest) {
    return { ok: false, reason: "no_club_stats", added: 0, skipped: 0, errors: 0, latestDocId: null };
  }

  const riders = Array.isArray(latest.riders) ? latest.riders : [];
  const riderCategoryByZwiftId = new Map();
  for (const r of riders) {
    if (!r || typeof r !== "object") continue;
    const zwiftId = normalizeId(r.riderId);
    const cat = normalizeZpCategory(r.zpCategory);
    if (!zwiftId || !cat) continue;
    riderCategoryByZwiftId.set(zwiftId, cat);
  }

  const linked = await getAllLinkedUsers();
  if (!linked.length) {
    return { ok: true, reason: "no_linked_users", added: 0, skipped: 0, errors: 0, latestDocId: latest.id };
  }

  // Ensure we can manage these roles (bot role higher than target roles)
  const botMember = await guild.members.fetch(guild.client.user.id);
  const botTopPosition = botMember.roles.highest?.position ?? 0;

  let added = 0;
  let skipped = 0;
  let errors = 0;
  const skippedReasons = {
    missingIds: 0,          // missing discordId/zwiftId in users collection
    notInClubStats: 0,      // linked zwiftId not found in latest club_stats snapshot
    unknownCategory: 0,     // zpCategory missing or not D/C/B/A/A+
    roleNotConfigured: 0,   // category mapped but env role id missing
    roleNotFound: 0,        // configured role id does not exist in guild
    memberNotFound: 0,      // user not in guild (left/kicked) or fetch failed
    isBot: 0,               // linked record points to a bot user
    alreadyHasRole: 0,      // role already present
    roleNotManageable: 0,   // role higher/equal to bot's highest role
  };

  for (const u of linked) {
    try {
      const discordId = normalizeId(u.discordId);
      const zwiftId = normalizeId(u.zwiftId);
      if (!discordId || !zwiftId) {
        skippedReasons.missingIds++;
        skipped++;
        continue;
      }

      const cat = riderCategoryByZwiftId.get(zwiftId);
      if (!cat) {
        skippedReasons.notInClubStats++;
        skipped++;
        continue;
      }
      const roleId = roleIdForCategory(cat);
      if (!roleId) {
        skippedReasons.roleNotConfigured++;
        skipped++;
        continue;
      }

      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        skippedReasons.roleNotFound++;
        skipped++;
        continue;
      }

      if (role.position >= botTopPosition) {
        // Can't manage this role; don't fail whole run.
        skippedReasons.roleNotManageable++;
        errors++;
        continue;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member || member.user?.bot) {
        if (!member) skippedReasons.memberNotFound++;
        else skippedReasons.isBot++;
        skipped++;
        continue;
      }

      if (member.roles.cache.has(roleId)) {
        skippedReasons.alreadyHasRole++;
        skipped++;
        continue;
      }

      await member.roles.add(roleId, `Daily ZP pace group sync (${cat})`);
      added++;
    } catch (e) {
      errors++;
    }
  }

  return {
    ok: true,
    reason: "synced",
    added,
    skipped,
    errors,
    skippedReasons,
    totals: {
      linkedUsers: linked.length,
      clubStatsRidersWithCategory: riderCategoryByZwiftId.size,
    },
    latestDocId: latest.id,
    latestTimestamp: latest.timestamp || null,
  };
}

module.exports = {
  syncZpRolesForGuild,
};


