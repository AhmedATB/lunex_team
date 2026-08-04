import { PrismaClient } from "@prisma/client";

/**
 * Bootstraps the first owner/admin account. There is deliberately no UI
 * button for this (the frontend used to have a client-side "impersonate any
 * role" switcher — removed once auth became real, since that's a privilege-
 * escalation hole once accounts are genuine). Every real auth system has
 * this same chicken-and-egg problem: promoting an admin normally requires an
 * existing admin, so the very first one has to be granted out-of-band.
 * A proper "promote user" endpoint, gated by manage_users, is a future
 * admin-panel-backend task — this script is the honest interim path.
 */
const VALID_ROLES = [
  "guest",
  "reader",
  "verified_member",
  "uploader",
  "moderator",
  "support",
  "news_manager",
  "editor",
  "global_team_manager",
  "super_administrator",
  "owner",
];

async function main() {
  const [, , emailOrUsername, role] = process.argv;

  if (!emailOrUsername || !role) {
    console.error("Usage: set-user-role.ts <email-or-username> <role>");
    console.error(`Valid roles: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`Unknown role "${role}". Valid roles: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  });
  if (!user) {
    console.error(`No user found with email or username "${emailOrUsername}".`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${updated.username} (${updated.email}) is now: ${updated.role}`);
  await prisma.$disconnect();
}

main();
