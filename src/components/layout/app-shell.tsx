import { Suspense, type ReactNode } from "react";
import type { StyleId } from "@/lib/theme-presets";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";
import { Ticker } from "./ticker";
import { PendingMain } from "./pending-main";
import { SparkleField } from "@/components/effects/sparkle-field";
import { NeonBackdrop } from "@/components/neon-backdrop";
import { MagicCursor } from "@/components/effects/magic-cursor";
import { ScrollPerformanceGuard } from "@/components/effects/scroll-performance-guard";
import { ToastHost } from "@/components/ui/toast-host";
import { ProgressWatcher } from "@/components/effects/progress-watcher";

export function AppShell({ children, initialStyle }: { children: ReactNode; initialStyle: StyleId }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <MagicCursor />
      <ScrollPerformanceGuard />
      <ToastHost />
      <ProgressWatcher />
      {/*
        Everything decorative below is `absolute` inside the page's own `relative` root: it belongs to the page and
        scrolls with it, never following the reader down the screen; the glows and sparkles pulse in place, nothing drifts. The glows sit at the page
        edges (half off-screen) and the sparkles along the margins, so they stay out from behind text.

        No negative z-index here (or on anything nested inside it) — deliberately. Verified
        empirically that a `z-index: -10` element painted fully invisible in this exact
        position (a direct/nested child of this `relative flex` root), while an otherwise
        identical element at `z-index: auto` rendered correctly; this reproduced consistently
        regardless of `position: absolute` vs `fixed` or nesting depth. This div being the
        FIRST child here is what actually keeps it behind Header/Ticker/main/Footer — plain
        DOM-order stacking among equal (auto) z-index siblings, not a negative z-index.
      */}
      {/* Cut from 6 blobs to 4 (perf pass, 2026-09-19) — each is a continuously-animated filter:blur(70px) element, real ongoing compositing cost for as long as the page is open. Positions kept spread top/mid/bottom so the page still reads as decorated end to end. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient-blob start-[-8%] top-[-4%] h-[28rem] w-[28rem] bg-primary-600/35" />
        <div className="ambient-blob end-[-10%] top-[18%] h-[26rem] w-[26rem] bg-secondary/30" style={{ animationDelay: "-6s" }} />
        <div className="ambient-blob start-[-12%] top-[55%] h-[22rem] w-[22rem] bg-accent/25" style={{ animationDelay: "-11s" }} />
        <div className="ambient-blob end-[-8%] top-[96%] h-[24rem] w-[24rem] bg-secondary/25" style={{ animationDelay: "-14s" }} />
        <SparkleField initialStyle={initialStyle} />
        {/* Neon Cyber only: anchored to the top of the page (its horizon grid), scrolls away with it. */}
        <NeonBackdrop initialStyle={initialStyle} />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(168,85,247,0.35) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <Header />
      <Ticker />
      <div className="flex flex-1">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <PendingMain>{children}</PendingMain>
        </main>
      </div>
      <Footer />
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
