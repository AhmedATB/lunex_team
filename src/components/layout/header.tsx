"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, Bell, Menu, LogOut, Settings, User as UserIcon, ShieldCheck, Coins, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/store/session";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { useRewards } from "@/store/rewards";
import { useMessages } from "@/store/messages";
import { getMockDatabase } from "@/lib/mock/generate";
import { GLOBAL_ROLE_LABELS, can } from "@/lib/rbac";
import { avatarUrl, cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const { currentUserId, logout } = useSession();
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const db = useMemo(() => getMockDatabase(), []);
  const currentUser = useMemo(
    () => db.users.find((u) => u.id === currentUserId),
    [db, currentUserId]
  );
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const coins = useRewards((s) => s.coins);
  const unreadBy = useMessages((s) => s.unreadBy);
  const hasUnreadMessages = useMemo(
    () => (currentUserId ? Object.values(unreadBy).some((ids) => ids.includes(currentUserId)) : false),
    [unreadBy, currentUserId]
  );
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-500",
        scrolled
          ? "border-b border-border bg-background/85 shadow-lg shadow-black/40 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="container flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/brand/icon-square.png"
            alt="LUNEX TEAM"
            width={34}
            height={34}
            className="rounded-full"
          />
          <span className="hidden font-display text-lg font-bold text-white sm:inline">
            LUNEX <span className="text-primary-400">TEAM</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="mx-2 hidden max-w-md flex-1 md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن مانهوا، مؤلف، تصنيف..."
              className="ps-9"
            />
          </div>
        </form>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="بحث"
          >
            <Search className="h-5 w-5" />
          </Button>

          <Link
            href="/store"
            className="hover-pop hidden items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-xs font-bold text-yellow-300 transition-colors hover:border-yellow-400/60 sm:flex"
          >
            <Coins className="h-3.5 w-3.5" /> {coins}
          </Link>

          <Button variant="ghost" size="icon" aria-label="الرسائل" className="relative" asChild>
            <Link href="/messages">
              <MessageCircle className="h-5 w-5" />
              {hasUnreadMessages && <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full border border-black bg-primary-400" />}
            </Link>
          </Button>

          <Button variant="ghost" size="icon" aria-label="الإشعارات" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full border border-black bg-amber-400" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-white/10 p-0.5 pe-2 transition-colors hover:border-primary-400/50 hover:bg-white/5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser ? avatarUrl(effectiveAvatarSeed(currentUser, avatarOverrides)) : undefined} />
                  <AvatarFallback>{currentUser?.displayName?.[0] ?? "ض"}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-white sm:inline">
                  {currentUser?.displayName ?? "زائر"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {currentUser ? (
                <>
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-white">{currentUser.displayName}</span>
                    <span className="text-[11px] text-primary-300">
                      {GLOBAL_ROLE_LABELS[currentUser.role]}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile"><UserIcon className="h-4 w-4" /> الملف الشخصي</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile?tab=settings"><Settings className="h-4 w-4" /> الإعدادات</Link>
                  </DropdownMenuItem>
                  {can(currentUser, "manage_users") && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin"><ShieldCheck className="h-4 w-4" /> لوحة الإدارة</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:bg-red-500/10">
                    <LogOut className="h-4 w-4" /> تسجيل الخروج
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href="/login">تسجيل الدخول</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="القائمة">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <form onSubmit={submitSearch} className="container pb-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث..."
              className="ps-9"
              autoFocus
            />
          </div>
        </form>
      )}
    </header>
  );
}
