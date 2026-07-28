import type { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-lunex-radial">
        <div className="ambient-blob start-[-10%] top-[-5%] h-96 w-96 bg-primary-600" />
        <div className="ambient-blob end-[-10%] top-[30%] h-[28rem] w-[28rem] bg-secondary" style={{ animationDelay: "-6s" }} />
        <div className="ambient-blob start-[20%] bottom-[-10%] h-96 w-96 bg-accent" style={{ animationDelay: "-12s" }} />
      </div>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
