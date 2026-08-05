"use client";

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 1_500_000; // ~1.5MB — this still ends up embedded directly in every page render (no real upload pipeline yet), so it has to stay small regardless of what the source photo was

/**
 * Downscales and re-encodes an uploaded image client-side before it's ever
 * stored. Without this, a raw phone-camera photo (routinely several MB)
 * went straight into a persisted Zustand store as an uncompressed base64
 * data URL — bloating localStorage toward its quota AND getting re-embedded
 * in full on every single render of that series' page, which is exactly
 * what made the site feel heavy. This keeps the "no server upload yet" MVP
 * approach honest by capping what it actually costs to render.
 */
export async function resizeImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  // Extremely detailed/high-contrast source images can still come out large
  // even after downscaling — step quality down a few times rather than
  // silently accepting an outsized result.
  while (dataUrl.length > MAX_OUTPUT_BYTES && quality > 0.4) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_OUTPUT_BYTES) {
    throw new Error("الصورة كبيرة جداً حتى بعد الضغط، جرّب صورة أخرى.");
  }

  return dataUrl;
}
