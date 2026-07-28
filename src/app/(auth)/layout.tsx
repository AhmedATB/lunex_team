import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-lunex-radial" />
      <div className="pointer-events-none absolute -top-20 start-1/4 -z-10 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 end-1/4 -z-10 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />

      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Image src="/brand/icon-square.png" alt="LUNEX TEAM" width={40} height={40} className="rounded-full" />
          <span className="font-display text-xl font-bold text-white">
            LUNEX <span className="text-primary-400">TEAM</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
