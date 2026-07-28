import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 ease-bounce focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-lunex-gradient text-white shadow-[0_4px_20px_-2px_rgba(109,40,217,0.55)] hover:scale-105 hover:brightness-110 hover:shadow-[0_8px_28px_-2px_rgba(168,85,247,0.75)] active:scale-95",
        secondary:
          "border border-white/15 bg-white/5 text-white hover:scale-105 hover:bg-white/10 hover:border-white/25 active:scale-95",
        outline:
          "border border-primary-400/60 text-primary-300 hover:scale-105 hover:bg-primary-600/10 active:scale-95",
        ghost: "text-foreground hover:scale-105 hover:bg-white/10 active:scale-95",
        destructive:
          "bg-red-600 text-white shadow-lg shadow-red-900/30 hover:scale-105 hover:bg-red-500 active:scale-95",
        link: "text-primary-300 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
