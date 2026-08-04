"use client";

const STORAGE_KEY = "lunex-device-id";

/**
 * A persisted-per-browser random id, sent as `x-device-fingerprint` on every
 * auth/image request. This is deliberately NOT a "real" canvas/WebGL/audio
 * fingerprint (that requires rendering hidden canvases and hashing pixel
 * output, a meaningfully larger client-side subsystem) — it's the honest
 * MVP version of the same contract: a stable identifier that ties a session
 * to the browser that created it, so a stolen token doesn't work elsewhere.
 * Upgrading to true entropy-based fingerprinting later is a drop-in swap of
 * this one function; nothing that consumes the header needs to change.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
