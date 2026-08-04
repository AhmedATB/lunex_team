import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as not requiring a valid access token. The default posture
 * (architecture doc §00 rule 2, "everything server-verified") is that every
 * endpoint requires auth unless explicitly opted out here — new endpoints
 * are secure by default instead of by remembering to add a guard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
