import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

/**
 * Creates one synthetic placeholder page image + its ImageAsset row, purely
 * so the signed-URL/watermark pipeline (ImagesModule) has something real to
 * serve end-to-end. Real chapter art is uploaded by teams through an admin
 * flow that doesn't exist yet — this script exists only to unblock verifying
 * the pipeline itself.
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
    create: { storageKey: key, checksum },
  });
  console.log("Seeded demo image asset:", asset.id);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
