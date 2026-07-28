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
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-blob start-[-8%] top-[-8%] h-[28rem] w-[28rem] bg-primary-600/35" />
        <div className="ambient-blob end-[-10%] top-[25%] h-[26rem] w-[26rem] bg-secondary/30" style={{ animationDelay: "-6s" }} />
        <div className="ambient-blob start-[15%] bottom-[-12%] h-[24rem] w-[24rem] bg-accent/25" style={{ animationDelay: "-11s" }} />
        <div className="ambient-blob end-[20%] bottom-[10%] h-[16rem] w-[16rem] bg-pink-500/20" style={{ animationDelay: "-3s" }} />
        <SparkleField />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(168,85,247,0.35) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
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
