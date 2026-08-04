import { SetMetadata } from "@nestjs/common";

export const REQUIRE_POW_KEY = "requirePow";

/** Opt-in (unlike auth, which is opt-out) — proof-of-work adds real client-side latency, so it's only worth paying on endpoints that are actual abuse targets: register, login, image token issuance. */
export const RequirePow = () => SetMetadata(REQUIRE_POW_KEY, true);
