import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm transition-colors",
  {
    variants: {
      variant: {
        default: "bg-lunex-gradient text-white",
        secondary: "bg-black/50 text-white",
        outline: "border border-primary-400/60 bg-transparent text-primary-300",
        success: "bg-emerald-400 text-emerald-950",
        warning: "bg-amber-400 text-amber-950",
        destructive: "bg-red-500 text-white",
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
