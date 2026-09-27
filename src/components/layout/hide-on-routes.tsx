"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Leaves part of the site's frame (the news strip, the footer, the bottom bar, the header) out of pages that are an app of their own,
 * like the chat: everywhere, or only below the `lg` breakpoint (`below`). The wrapper is always there, so going to and from such a
 * page never rebuilds what is inside it.
 */
export function HideOnRoutes({ prefixes, below, children }: { prefixes: string[]; below?: "lg"; children: ReactNode }) {
  const path = usePathname();
  const hidden = prefixes.some((p) => path === p || path.startsWith(`${p}/`));
  return <div className={hidden ? (below ? "hidden lg:contents" : "hidden") : "contents"}>{children}</div>;
}
