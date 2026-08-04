const WINDOW_MS = 60_000;
const DISTINCT_ASSET_THRESHOLD = 40;

/**
 * A human reading a chapter requests a handful of page tokens a minute at
 * most, even reading fast. A scraper harvesting a whole series requests
 * dozens to hundreds of DISTINCT page ids per minute from one device — that
 * shape (many different assets, one device, short window), not raw request
 * count, is the tell. This is a starting threshold, not a tuned one; a
 * production deployment should differentiate "reading through one chapter
 * sequentially" from "reading across many unrelated chapters/series" before
 * tightening it further.
 *
 * In-memory, single-process — same multi-instance caveat as the other
 * in-memory security state in this module (needs Redis to hold across
 * instances).
 */
export class ScrapingVelocityTracker {
  private readonly byDevice = new Map<string, { assets: Set<string>; windowStart: number }>();

  /** Returns false once the device has touched more than the threshold of distinct assets within the rolling window. */
  record(deviceFingerprint: string, assetId: string): boolean {
    const now = Date.now();
    let entry = this.byDevice.get(deviceFingerprint);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      entry = { assets: new Set(), windowStart: now };
      this.byDevice.set(deviceFingerprint, entry);
    }
    entry.assets.add(assetId);
    return entry.assets.size <= DISTINCT_ASSET_THRESHOLD;
  }
}
