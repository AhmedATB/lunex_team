"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "./nav-items";
import { Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-e-2 border-white/20 bg-[#0c0715] p-4 lg:flex">
      <nav className="flex flex-col gap-1">
        {SIDEBAR_NAV.map((item) => {
          const active = pathname === item.href.split("?")[0];
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 border-2 px-3 py-2.5 text-sm font-bold transition-colors",
                active
                  ? "border-white/80 bg-lunex-gradient text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]"
                  : "border-transparent text-lunex-gray hover:border-white/25 hover:text-white"
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
