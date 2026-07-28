import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-lunex-gray transition-colors focus-visible:outline-none focus-visible:border-primary-400 focus-visible:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
