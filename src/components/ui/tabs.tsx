"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * One row that scrolls sideways when the tabs do not fit (a phone), never wrapping onto a second line: a wrapped row cannot fit
 * the fixed height and the lines land on top of each other. The active tab is brought into view inside the row, without moving the page.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, forwarded) => {
  const local = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const list = local.current;
    if (!list) return;
    const reveal = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || list.scrollWidth <= list.clientWidth) return;
      const a = active.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      // scrollBy takes physical directions, so this is right for right-to-left too
      list.scrollBy({ left: a.left + a.width / 2 - (l.left + l.width / 2), behavior: "smooth" });
    };
    reveal();
    const watch = new MutationObserver(reveal);
    watch.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    return () => watch.disconnect();
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        local.current = node;
        if (typeof forwarded === "function") forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
      className={cn(
        "inline-flex h-12 max-w-full items-center justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-white/10 bg-white/5 p-1 [scrollbar-width:none] sm:h-11 [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-bold sm:h-9 text-lunex-gray transition-all data-[state=active]:bg-lunex-gradient data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary-900/40",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4 focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
