import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { R2StorageService } from "../src/modules/images/storage/r2-storage.service";

/**
 * One-off, idempotent copy of every image_blobs row into R2 under its
 * existing storageKey — run BEFORE flipping IMAGE_STORAGE_BACKEND to "r2"
 * (see the plan's cutover sequence). Never deletes Postgres data; that's a
 * separate, explicit cleanup script run only after this one's report shows
 * failed: 0 and a manual spot-check passes.
 *
 * Safe to re-run: a key already present in R2 with byte-identical content
 * is skipped (still checksum-verified via readback); a key present but
 * different is re-uploaded, with a warning, never silently ignored.
 *
 * Usage: npx ts-node scripts/migrate-image-blobs-to-r2.ts
 * Requires R2_ACCOUNT_ID / R2_BUCKET_NAME / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY set in the environment (backend/.env).
 */
async function main() {
  const prisma = new PrismaClient();
  // Duck-typed ConfigService substitute — R2StorageService only ever calls .get(key).
  const r2 = new R2StorageService({ get: (key: string) => process.env[key] } as never);

  const keys = await prisma.imageBlob.findMany({ select: { storageKey: true } });
  let succeeded = 0;
  let failed = 0;
  const failures: { storageKey: string; error: string }[] = [];

  for (const { storageKey } of keys) {
    try {
      const row = await prisma.imageBlob.findUnique({ where: { storageKey } });
      if (!row) continue;
      const data = Buffer.from(row.data);
      const expectedChecksum = createHash("sha256").update(data).digest("hex");

      let skip = false;
      try {
        const existing = await r2.get(storageKey);
        if (Buffer.compare(existing, data) === 0) skip = true;
        else console.warn(`[migrate] ${storageKey}: exists in R2 but differs — re-uploading`);
      } catch {
        // Not found in R2 yet — proceed to upload below.
      }

      if (!skip) {
        const { checksum } = await r2.put(storageKey, data);
        if (checksum !== expectedChecksum) {
          throw new Error(`checksum mismatch after put: expected ${expectedChecksum}, got ${checksum}`);
        }
      }

      const verify = await r2.get(storageKey);
      if (Buffer.compare(verify, data) !== 0) {
        throw new Error("post-upload readback did not match source bytes");
      }
      succeeded++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ storageKey, error: message });
      console.error(`[migrate] FAILED ${storageKey}:`, message);
    }
  }

  console.log(JSON.stringify({ succeeded, failed, total: keys.length }, null, 2));
  if (failures.length) console.table(failures);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
