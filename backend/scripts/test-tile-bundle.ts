/**
 * Standalone verification of the tile-bundle encrypt/decrypt round trip —
 * runs the exact server-side buildTileBundle/encryptBundle used by
 * ImagesService.streamAsset, then decrypts and reassembles it the same way
 * the browser client (protected-page.tsx) does, using Node's WebCrypto
 * (crypto.webcrypto.subtle matches the browser's crypto.subtle exactly).
 * Not wired into any real HTTP flow — pure logic verification.
 */
import { randomBytes, webcrypto } from "node:crypto";
import sharp from "sharp";
import { buildTileBundle, encryptBundle } from "../src/modules/images/tiling/tile-bundle.util";

async function main() {
  const width = 900;
  const height = 1350;

  // Four distinct-colored quadrants so tile reassembly position errors are visually/numerically detectable.
  const quadrants = [
    { color: { r: 255, g: 0, b: 0 }, x: 0, y: 0 },
    { color: { r: 0, g: 255, b: 0 }, x: width / 2, y: 0 },
    { color: { r: 0, g: 0, b: 255 }, x: 0, y: height / 2 },
    { color: { r: 255, g: 255, b: 0 }, x: width / 2, y: height / 2 },
  ];
  let testImage = sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } } });
  const overlays = await Promise.all(
    quadrants.map((q) =>
      sharp({ create: { width: width / 2, height: height / 2, channels: 3, background: q.color } })
        .png()
        .toBuffer()
        .then((buf) => ({ input: buf, left: Math.round(q.x), top: Math.round(q.y) }))
    )
  );
  const original = await testImage.composite(overlays).png().toBuffer();

  console.log(`Test image: ${width}x${height}, ${original.length} bytes`);

  const bundleKey = randomBytes(32).toString("base64url");

  const plaintextBundle = await buildTileBundle(original, width, height);
  console.log(`Plaintext bundle: ${plaintextBundle.length} bytes`);

  const encrypted = encryptBundle(plaintextBundle, bundleKey);
  console.log(`Encrypted wire payload: ${encrypted.length} bytes (iv 12 + tag 16 + ciphertext ${encrypted.length - 28})`);

  // --- Client-side decrypt, mirroring protected-page.tsx exactly ---
  const iv = encrypted.subarray(0, 12);
  const ciphertextAndTag = encrypted.subarray(12);
  const keyBytes = Buffer.from(bundleKey, "base64url");
  const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertextAndTag));

  if (Buffer.compare(Buffer.from(plaintext), plaintextBundle) !== 0) {
    throw new Error("FAIL: decrypted plaintext does not match original bundle");
  }
  console.log("PASS: decrypt round-trip matches exactly");

  const manifestLength = new DataView(plaintext.buffer, plaintext.byteOffset, 4).getUint32(0, false);
  const manifestJson = new TextDecoder().decode(plaintext.slice(4, 4 + manifestLength));
  const manifest: { cols: number; rows: number; tiles: { id: string; row: number; col: number; x: number; y: number; w: number; h: number; byteLength: number }[] } =
    JSON.parse(manifestJson);

  console.log(`Manifest: ${manifest.cols}x${manifest.rows} grid, ${manifest.tiles.length} tiles`);
  if (manifest.cols < 2 || manifest.cols > 5 || manifest.rows < 2 || manifest.rows > 5) {
    throw new Error(`FAIL: grid ${manifest.cols}x${manifest.rows} outside the 2..5 clamp`);
  }
  console.log("PASS: adaptive grid within 2x2..5x5 bounds");

  // Reassemble onto a canvas-equivalent (sharp composite) and verify per-quadrant color.
  let offset = 4 + manifestLength;
  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (const tile of manifest.tiles) {
    const tileBytes = Buffer.from(plaintext.slice(offset, offset + tile.byteLength));
    offset += tile.byteLength;
    composites.push({ input: tileBytes, left: tile.x, top: tile.y });
  }
  const canvasWidth = Math.max(...manifest.tiles.map((t) => t.x + t.w));
  const canvasHeight = Math.max(...manifest.tiles.map((t) => t.y + t.h));
  const reassembled = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });

  function pixelAt(x: number, y: number) {
    const idx = (y * reassembled.info.width + x) * reassembled.info.channels;
    return { r: reassembled.data[idx], g: reassembled.data[idx + 1], b: reassembled.data[idx + 2] };
  }

  const checks: { label: string; x: number; y: number; expect: { r: number; g: number; b: number } }[] = [
    { label: "top-left (red)", x: 10, y: 10, expect: { r: 255, g: 0, b: 0 } },
    { label: "top-right (green)", x: width - 10, y: 10, expect: { r: 0, g: 255, b: 0 } },
    { label: "bottom-left (blue)", x: 10, y: height - 10, expect: { r: 0, g: 0, b: 255 } },
    { label: "bottom-right (yellow)", x: width - 10, y: height - 10, expect: { r: 255, g: 255, b: 0 } },
  ];

  for (const check of checks) {
    const px = pixelAt(check.x, check.y);
    const close = Math.abs(px.r - check.expect.r) < 5 && Math.abs(px.g - check.expect.g) < 5 && Math.abs(px.b - check.expect.b) < 5;
    if (!close) {
      throw new Error(
        `FAIL: ${check.label} at (${check.x},${check.y}) expected rgb(${check.expect.r},${check.expect.g},${check.expect.b}) got rgb(${px.r},${px.g},${px.b}) — tile misplacement`
      );
    }
    console.log(`PASS: ${check.label} pixel matches (tiles correctly positioned after shuffle+reassembly)`);
  }

  // Tamper check: flipping one byte of ciphertext must make GCM reject it (authenticity, not just confidentiality).
  const tampered = Buffer.from(encrypted);
  tampered[20] ^= 0xff;
  try {
    await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: tampered.subarray(0, 12) }, key, tampered.subarray(12));
    throw new Error("FAIL: tampered ciphertext was accepted — GCM auth tag check is not working");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("FAIL")) throw err;
    console.log("PASS: tampered ciphertext correctly rejected (GCM authenticity check works)");
  }

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
