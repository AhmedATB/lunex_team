"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09090B]/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-6">
        {BOTTOM_NAV.map((item) => {
          const active = pathname === item.href.split("?")[0];
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
