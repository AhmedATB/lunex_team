"use client";

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

export interface PowChallenge {
  nonce: string;
  difficulty: number;
  expiresIn: number;
}

/**
 * Brute-forces a solution to the server's proof-of-work challenge: find a
 * value whose SHA-256(nonce:value) has `difficulty` leading hex zeros. This
 * runs on the main thread by design — the whole point is that it costs the
 * calling browser real, felt CPU time, the same cost a scripted client would
 * have to pay per request to hit an endpoint at scale (see backend
 * ProofOfWorkService for the server side of this contract).
 */
export async function solvePow(challenge: PowChallenge): Promise<string> {
  const target = "0".repeat(challenge.difficulty);
  let counter = 0;
  while (true) {
    const candidate = String(counter);
    const hash = await sha256Hex(`${challenge.nonce}:${candidate}`);
    if (hash.startsWith(target)) return `${challenge.nonce}:${candidate}`;
    counter++;
  }
}

/** Fetches a fresh challenge from our own BFF route (never the backend directly) and solves it. */
export async function fetchAndSolvePow(): Promise<string> {
  const res = await fetch("/api/auth/challenge");
  if (!res.ok) throw new Error("Failed to fetch proof-of-work challenge.");
  const challenge: PowChallenge = await res.json();
  return solvePow(challenge);
}
