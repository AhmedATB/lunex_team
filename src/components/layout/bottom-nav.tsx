"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-6">
        {BOTTOM_NAV.map((item) => {
          // Explore (/series) and Novels (/series?type=novel) share a pathname
          // and differ only by query — comparing pathname alone lights up both
          // at once, same bug already fixed for the desktop sidebar.
          const [hrefPath, hrefQuery] = item.href.split("?");
          const active = hrefQuery
            ? pathname === hrefPath && searchParams.toString() === hrefQuery
            : pathname === hrefPath && searchParams.toString() === "";
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors",
                active ? "text-primary-300" : "text-lunex-gray"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="h-safe-bottom" />
    </nav>
  );
}
