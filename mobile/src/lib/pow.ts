import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { apiJson } from "./api";

interface PowChallenge {
  nonce: string;
  difficulty: number;
  expiresIn: number;
}

/** Whether the digest starts with `difficulty` zero hex digits, read straight from the bytes (no hex string per try). */
function hasLeadingZeros(digest: Uint8Array, difficulty: number): boolean {
  const fullBytes = difficulty >> 1;
  for (let i = 0; i < fullBytes; i++) if (digest[i] !== 0) return false;
  return difficulty % 2 === 0 || digest[fullBytes] >> 4 === 0;
}

/** Yields to the UI thread every so often, so the spinner keeps turning while the phone works. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The server's proof-of-work gate in front of sign-in: find a value whose SHA-256(`nonce:value`) starts with `difficulty`
 * zero hex digits. Same contract as the site's pow-client; the answer goes in the `x-pow-solution` header.
 */
export async function fetchAndSolvePow(): Promise<string> {
  const challenge = await apiJson<PowChallenge>("/api/auth/challenge");
  for (let counter = 0; ; counter++) {
    if (counter % 4096 === 4095) await breathe();
    if (hasLeadingZeros(sha256(utf8ToBytes(`${challenge.nonce}:${counter}`)), challenge.difficulty)) {
      return `${challenge.nonce}:${counter}`;
    }
  }
}
