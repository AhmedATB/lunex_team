import * as argon2 from "argon2";

/**
 * Argon2id over bcrypt/scrypt — deliberately memory-hard, which specifically
 * resists GPU/ASIC cracking rigs the way bcrypt (compute-hard only) doesn't.
 * Parameters below follow OWASP's current minimum recommendation for
 * Argon2id (19 MiB memory, 2 iterations, 1 degree of parallelism) — tuned up
 * for production hardware, not left at library defaults.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed/foreign hash (e.g. a dummy hash used for timing-attack
    // resistance, see AuthService.login) — treat as "does not match", not
    // as a crash.
    return false;
  }
}

/**
 * A real Argon2id hash of a value nobody will ever type. Used to verify()
 * against on an unknown-email login attempt so the response takes the same
 * wall-clock time whether the account exists or not — the whole point of
 * Argon2id being slow is defeated if we skip it for exactly the requests an
 * enumeration attack sends.
 *
 * Lazily computed and memoized (not a top-level await — this project builds
 * to CommonJS, which doesn't support that) on the first login attempt, then
 * reused for the lifetime of the process.
 */
let dummyHashCache: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  if (!dummyHashCache) {
    dummyHashCache = hashPassword("lunex-timing-attack-mitigation-do-not-use-as-a-real-password");
  }
  return dummyHashCache;
}
