import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold uppercase tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-2 border-white/85 bg-lunex-gradient text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.55)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_rgba(0,0,0,0.55)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.55)]",
        secondary:
          "border-2 border-white/70 bg-[#150c26] text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_rgba(0,0,0,0.5)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.5)]",
        outline:
          "border-2 border-primary-400 text-primary-300 hover:bg-primary-600/15 active:scale-[0.97]",
        ghost: "text-foreground normal-case tracking-normal hover:bg-white/10 active:scale-[0.97]",
        destructive:
          "border-2 border-white/70 bg-red-600 text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] hover:bg-red-500 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        link: "text-primary-300 normal-case tracking-normal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
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
