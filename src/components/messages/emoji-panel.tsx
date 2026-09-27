"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { EMOJI_GROUPS, loadRecentEmoji, rememberEmoji } from "@/lib/emoji-data";

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * The emoji drawer under the message box, in the place the phone's keyboard was (the way Telegram does it): a grid of the group
 * that is open, the ones used lately first, and a bar of groups at the bottom. The buttons never take focus, so the message box
 * keeps its caret and the emoji lands where it is.
 */
export function EmojiPanel({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [recent, setRecent] = useState<string[]>([]);
  const [group, setGroup] = useState("smileys");

  useEffect(() => {
    const saved = loadRecentEmoji();
    setRecent(saved);
    if (saved.length > 0) setGroup("recent");
  }, []);

  const emojis = group === "recent" ? recent : (EMOJI_GROUPS.find((g) => g.id === group)?.emojis ?? []);
  const tabs = [...(recent.length > 0 ? [{ id: "recent", label: "الأخيرة", icon: "🕒" }] : []), ...EMOJI_GROUPS];

  function pick(emoji: string) {
    setRecent(rememberEmoji(emoji));
    onPick(emoji);
  }

  return (
    <div className={cn("flex h-[15.5rem] flex-col border-t border-white/10 bg-background/95", className)} aria-label="الرموز التعبيرية">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" role="tabpanel">
        <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-12" style={{ fontFamily: EMOJI_FONT }}>
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(emoji)}
              className="flex h-10 items-center justify-center rounded-lg text-2xl transition active:scale-90 hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 border-t border-white/10" role="tablist" aria-label="مجموعات الرموز">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={group === tab.id}
            aria-label={tab.label}
            title={tab.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setGroup(tab.id)}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center justify-center text-xl transition-colors",
              group === tab.id ? "bg-primary-600/20" : "opacity-60 hover:opacity-100"
            )}
            style={{ fontFamily: EMOJI_FONT }}
          >
            {tab.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
