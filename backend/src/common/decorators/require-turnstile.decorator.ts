import { SetMetadata } from "@nestjs/common";

export const REQUIRE_TURNSTILE_KEY = "requireTurnstile";

/**
 * Opt-in, like {@link RequirePow}: the visitor must have passed Cloudflare Turnstile (the "I am not a robot" box) on the page
 * that sends this request. `action` names the form ("register", "login", "forgot") and is checked against the one the widget
 * was rendered with, so a token earned on one form cannot be spent on another. Does nothing while `TURNSTILE_SECRET_KEY` is unset.
 */
export const RequireTurnstile = (action: string) => SetMetadata(REQUIRE_TURNSTILE_KEY, action);
