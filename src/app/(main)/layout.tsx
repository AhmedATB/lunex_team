import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getInitialStyle } from "@/lib/theme-cookie";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const initialStyle = await getInitialStyle();
  return <AppShell initialStyle={initialStyle}>{children}</AppShell>;
}
