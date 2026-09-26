"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useSignedInUserId } from "@/components/session-hint";
import { cn } from "@/lib/utils";

/**
 * What a visitor without an account sees where a member could act (comment, rate, save a series ...): a line saying what
 * signing in would give them, with the way to do it. Renders nothing for a member.
 */
export function GuestPrompt({ text, className }: { text: string; className?: string }) {
  const signedIn = useSignedInUserId();
  const pathname = usePathname();
  if (signedIn) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-lunex-gray", className)}>
      <Lock className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />
      <span>{text}</span>
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-semibold text-primary-300 hover:underline">
        تسجيل الدخول
      </Link>
      <span>أو</span>
      <Link href="/register" className="font-semibold text-primary-300 hover:underline">
        إنشاء حساب
      </Link>
    </div>
  );
}
