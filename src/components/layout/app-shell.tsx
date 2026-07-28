import type { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";
import { Ticker } from "./ticker";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(168,85,247,0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)",
        }}
      />
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
