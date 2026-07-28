"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-white/25 bg-[#09090B] lg:hidden">
      <div className="grid grid-cols-5">
        {BOTTOM_NAV.map((item) => {
          const active = pathname === item.href.split("?")[0];
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 border-t-2 py-2.5 text-[11px] font-bold transition-colors",
                active ? "border-primary-400 text-primary-300" : "border-transparent text-lunex-gray"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="h-safe-bottom" />
    </nav>
  );
}
