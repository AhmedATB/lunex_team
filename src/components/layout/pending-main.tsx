"use client";

import { useEffect, useState } from "react";
import { useNavigation } from "@/store/navigation";
import {
  GridPageSkeleton,
  HomeSkeleton,
  ProfileSkeleton,
  ReaderSkeleton,
  SeriesDetailSkeleton,
} from "@/components/shared/skeletons";

/** Long enough that instant (already-prefetched) navigations never flash a skeleton, short enough to read as immediate. */
const SHOW_AFTER_MS = 80;

function skeletonFor(href: string) {
  const path = href.split("?")[0];
  if (path === "/") return <HomeSkeleton />;
  if (/^\/series\/[^/]+\/[^/]+$/.test(path)) return <ReaderSkeleton />;
  if (/^\/series\/[^/]+$/.test(path)) return <SeriesDetailSkeleton />;
  if (/^\/(teams|profile)\/(?!create$|settings$)[^/]+$/.test(path)) return <ProfileSkeleton />;
  return <GridPageSkeleton />;
}

/**
 * The page area. As soon as a link is clicked the old page is hidden (kept
 * mounted, so nothing is lost if the navigation is abandoned) and the
 * destination's skeleton takes its place until the new page arrives.
 */
export function PendingMain({ children }: { children: React.ReactNode }) {
  const pendingHref = useNavigation((s) => s.pendingHref);
  const [showFor, setShowFor] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingHref) {
      setShowFor(null);
      return;
    }
    const t = setTimeout(() => {
      window.scrollTo(0, 0);
      setShowFor(pendingHref);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [pendingHref]);

  return (
    <>
      {showFor && skeletonFor(showFor)}
      <div hidden={showFor !== null}>{children}</div>
    </>
  );
}
