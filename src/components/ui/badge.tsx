import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-2 px-2.5 py-0.5 text-xs font-black transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/80 bg-lunex-gradient text-white",
        secondary: "border-white/70 bg-[#150c26] text-white",
        outline: "border-primary-400 bg-transparent text-primary-300 shadow-none",
        success: "border-white/80 bg-emerald-400 text-emerald-950",
        warning: "border-white/80 bg-amber-400 text-amber-950",
        destructive: "border-white/80 bg-red-500 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
