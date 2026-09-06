"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "./nav-items";
import { Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-e border-border bg-background p-4 lg:flex">
      <nav className="flex flex-col gap-1">
        {SIDEBAR_NAV.map((item) => {
          // Some nav items share a pathname but differ only by query (e.g. /series
          // vs /series?type=novel) — comparing pathname alone would light up both
          // at once, so an item with a query string must match that query exactly,
          // and a plain item must match only when there's no query at all.
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                active
                  ? "bg-lunex-gradient text-white shadow-md shadow-primary-900/40"
                  : "text-lunex-gray hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="panel mt-4 p-4">
        <Sparkles className="mb-2 h-5 w-5 text-primary-300" />
        <p className="text-sm font-black text-white">انضم إلى فريق LUNEX</p>
        <p className="mt-1 text-xs text-lunex-gray">
          نبحث دائماً عن مترجمين ومدققين وموزعي صفحات موهوبين.
        </p>
        <Link
          href="/teams"
          className="mt-3 inline-block text-xs font-bold text-primary-300 hover:text-primary-200"
        >
          قدّم الآن ←
        </Link>
      </div>
    </aside>
  );
}
