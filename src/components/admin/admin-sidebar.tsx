"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard } from "lucide-react";
import { useSession } from "@/store/session";
import { ADMIN_NAV, type NavItem } from "@/components/layout/nav-items";

export function AdminSidebar() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const user = useSession((s) => s.user);

  // Someone who holds no site role (a team's leader, publisher or uploader) manages through their team's own page; the rest of this
  // area is the site's staff — most of it would only answer "not allowed" to them.
  const teamOnly = !!user && (user.role === "reader" || user.role === "verified_member");
  const items: NavItem[] = teamOnly
    ? [ADMIN_NAV[0], ...(user.teamAccess ?? []).map((access) => ({ href: `/teams/${access.slug}/dashboard`, label: `${access.level === "lead" ? "إدارة" : "فصول"} ${access.name}`, icon: LayoutDashboard }))]
    : ADMIN_NAV;

  // On a phone the links sit in one row that scrolls: bring the current page's link into view (inside the row, not the page).
  useEffect(() => {
    const row = nav.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    const a = active.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    row.scrollBy({ left: a.left + a.width / 2 - (r.left + r.width / 2) });
  }, [pathname]);

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <nav ref={nav} className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors",
                active ? "bg-lunex-gradient text-white shadow-glow" : "text-lunex-gray hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
