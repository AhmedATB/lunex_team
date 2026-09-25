// Runs before `prisma migrate deploy` (see "start:prod").
//
// A migration that fails is recorded as failed, and Prisma then refuses every later
// `migrate deploy` (P3009) until someone marks it rolled back — which takes the site down
// until a person gets to a shell. The migrations listed here are known to be
// transactional (a failure leaves nothing behind) and to have been fixed since they
// failed, so it is safe to let the next start retry them by itself.
//
// Only a migration that is currently failed (started, never finished, not rolled back)
// and named below is touched; anything else is left alone. This script never fails the
// start: on a brand-new database there is no _prisma_migrations table yet.
const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const RETRYABLE = ["20260926180000_add_catalog"];

async function main() {
  const prisma = new PrismaClient();
  try {
    const failed = await prisma.$queryRaw`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    for (const { migration_name: name } of failed) {
      if (!RETRYABLE.includes(name)) {
        console.log(`resolve-failed-migrations: ${name} is failed but not on the retry list; leaving it.`);
        continue;
      }
      console.log(`resolve-failed-migrations: marking ${name} as rolled back so it can be applied again.`);
      execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "resolve", "--rolled-back", name], {
        stdio: "inherit",
      });
    }
  } catch (err) {
    console.log(`resolve-failed-migrations: nothing to do (${err.message.split("\n")[0]})`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
