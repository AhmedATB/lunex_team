import type { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";
import { Ticker } from "./ticker";
import { SparkleField } from "@/components/effects/sparkle-field";
import { MagicCursor } from "@/components/effects/magic-cursor";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <MagicCursor />
      {/*
        This layer is `absolute` (not `fixed`) inside the page's own `relative` root, so it
        stretches to the FULL scrollable page height and stars/blobs are distributed all the
        way down — `fixed` only covers the first viewport, leaving the rest of a long page
        (like the homepage) with no decoration at all once you scroll past it.
      */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="ambient-blob start-[-8%] top-[-4%] h-[28rem] w-[28rem] bg-primary-600/35" />
        <div className="ambient-blob end-[-10%] top-[18%] h-[26rem] w-[26rem] bg-secondary/30" style={{ animationDelay: "-6s" }} />
        <div className="ambient-blob start-[15%] top-[42%] h-[24rem] w-[24rem] bg-accent/25" style={{ animationDelay: "-11s" }} />
        <div className="ambient-blob end-[20%] top-[62%] h-[20rem] w-[20rem] bg-pink-500/25" style={{ animationDelay: "-3s" }} />
        <div className="ambient-blob start-[5%] top-[85%] h-[22rem] w-[22rem] bg-primary-600/30" style={{ animationDelay: "-9s" }} />
        <div className="ambient-blob end-[8%] top-[100%] h-[24rem] w-[24rem] bg-secondary/25" style={{ animationDelay: "-14s" }} />
        <SparkleField />
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
        <Sidebar />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
