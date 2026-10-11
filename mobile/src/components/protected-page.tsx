import { Image } from "expo-image";
import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { loadPage, PageLoadError, type DecodedPage } from "../lib/page-loader";
import { colors } from "../theme";
import { Txt } from "./ui";

/** At most this many pages download at once across the chapter — a weak network or a fast scroll would otherwise trip the server's rate limit. */
const MAX_PARALLEL = 4;
let running = 0;
const waiting: (() => void)[] = [];
function acquireSlot(): Promise<void> {
  if (running < MAX_PARALLEL) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) =>
    waiting.push(() => {
      running++;
      resolve();
    }),
  );
}
function releaseSlot() {
  running--;
  waiting.shift()?.();
}

/** 1 s, 2 s, 4 s … up to 30 s, a little randomised so a screenful of failures does not retry in lockstep. */
const backoffMs = (attempt: number) => Math.min(30_000, 1_000 * 2 ** (attempt - 1)) * (0.75 + Math.random() * 0.5);
const MAX_ATTEMPTS = 12;

/** The height a page holds before it has loaded: a typical webtoon page is a little taller than wide. */
const PLACEHOLDER_RATIO = 1.5;

/**
 * One protected chapter page: fetched, decrypted and laid out tile by tile at its manifest position. `active` is false for
 * pages far from the screen, so a 70-page chapter does not download all at once.
 */
export const ProtectedPage = memo(function ProtectedPage({
  chapterId,
  pageNumber,
  width,
  active,
  onBlocked,
}: {
  chapterId: string;
  pageNumber: number;
  width: number;
  active: boolean;
  /** The server refused for a reason retrying cannot fix (locked chapter, signed out). */
  onBlocked?: (code: string) => void;
}) {
  const [page, setPage] = useState<DecodedPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [started, setStarted] = useState(active);

  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    setFailed(false);

    async function run() {
      attempt++;
      await acquireSlot();
      if (cancelled) return releaseSlot();
      try {
        const decoded = await loadPage(chapterId, pageNumber);
        if (!cancelled) setPage(decoded);
      } catch (err) {
        if (cancelled) return;
        const retryable = err instanceof PageLoadError ? err.retryable : true;
        if (!retryable) {
          setFailed(true);
          if (err instanceof PageLoadError) onBlocked?.(err.code);
        } else if (attempt >= MAX_ATTEMPTS) setFailed(true);
        else timer = setTimeout(run, backoffMs(attempt));
      } finally {
        releaseSlot();
      }
    }

    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // onBlocked is a plain notification; re-running because its identity changed would re-download the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, chapterId, pageNumber, retryNonce]);

  if (!page) {
    return (
      <View style={[styles.placeholder, { width, height: width * PLACEHOLDER_RATIO }]}>
        {failed ? (
          <Pressable onPress={() => setRetryNonce((n) => n + 1)} style={styles.retry}>
            <Txt color={colors.muted}>تعذر تحميل الصفحة {pageNumber}</Txt>
            <Txt weight="700" color={colors.lilac}>
              إعادة المحاولة
            </Txt>
          </Pressable>
        ) : (
          <ActivityIndicator color={colors.faint} />
        )}
      </View>
    );
  }

  const scale = width / page.width;
  return (
    <View style={{ width, height: page.height * scale, backgroundColor: "#000" }}>
      {page.tiles.map((tile, i) => (
        <Image
          key={i}
          source={{ uri: tile.uri }}
          // a hair of overlap hides the seams rounding leaves between neighbouring tiles
          style={{
            position: "absolute",
            left: tile.x * scale,
            top: tile.y * scale,
            width: tile.w * scale + 0.5,
            height: tile.h * scale + 0.5,
          }}
          contentFit="fill"
          cachePolicy="none"
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#0d0d10" },
  retry: { alignItems: "center", gap: 8, padding: 24 },
});
