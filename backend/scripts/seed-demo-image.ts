import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

/**
 * Creates one synthetic placeholder page image + its ImageAsset row, purely
 * so the signed-URL/watermark pipeline (ImagesModule) has something real to
 * serve end-to-end.
 *
 * Writes straight to local disk, bypassing StorageService — only correct
 * when running the backend with IMAGE_STORAGE_BACKEND=local. Against the
 * default Postgres-backed storage (PrismaBlobStorageService) this seeds the
 * ImageAsset row but not the actual bytes; streamAsset would 404. Superseded
 * once the real chapter-upload endpoint (chapters.controller.ts) exists —
 * kept only as a quick manual way to poke the pipeline in isolation.
 */
async function main() {
  const storageDir = resolve(process.env.IMAGE_STORAGE_DIR ?? "./storage/images");
  const key = "demo/page-001.png";
  const filePath = join(storageDir, key);
  await mkdir(join(filePath, ".."), { recursive: true });

  const placeholder = await sharp({
    create: { width: 800, height: 1200, channels: 3, background: { r: 20, g: 24, b: 38 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
            <rect width="800" height="1200" fill="#141826"/>
            <text x="400" y="600" font-size="36" fill="#ffffff" text-anchor="middle" font-family="sans-serif">LUNEX TEAM demo page</text>
          </svg>`
        ),
      },
    ])
    .png()
    .toBuffer();

  await writeFile(filePath, placeholder);
  const checksum = createHash("sha256").update(placeholder).digest("hex");

  const prisma = new PrismaClient();
  const asset = await prisma.imageAsset.upsert({
    where: { storageKey: key },
    update: { checksum },
    create: { storageKey: key, checksum, mimeType: "image/png", width: 800, height: 1200 },
  });
  console.log("Seeded demo image asset:", asset.id);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
