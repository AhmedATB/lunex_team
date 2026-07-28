"use client";

import { Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "@/store/reader-settings";
import { cn } from "@/lib/utils";

export function BookmarkButton({ seriesId }: { seriesId: string }) {
  const isBookmarked = useBookmarks((s) => s.isBookmarked(seriesId));
  const toggleBookmark = useBookmarks((s) => s.toggleBookmark);

  return (
    <Button variant={isBookmarked ? "default" : "secondary"} onClick={() => toggleBookmark(seriesId)}>
      <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-white")} />
      {isBookmarked ? "في المفضلة" : "أضف للمفضلة"}
    </Button>
  );
}

export function ShareButton() {
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: document.title, url: window.location.href });
      } catch {
        /* user cancelled */
      }
    } else if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(window.location.href);
    }
  }
  return (
    <Button variant="secondary" size="icon" onClick={share} aria-label="مشاركة">
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
