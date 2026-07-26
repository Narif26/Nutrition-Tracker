"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--accent)] text-white shadow-[0_12px_30px_rgba(15,123,102,0.22)] hover:bg-[color:var(--accent-strong)]",
        secondary:
          "bg-white/70 text-[color:var(--foreground)] shadow-[0_12px_30px_rgba(28,42,52,0.08)] hover:bg-white",
        ghost: "bg-transparent text-[color:var(--muted-foreground)] hover:bg-white/50",
        outline:
          "border border-[color:var(--border)] bg-white/70 text-[color:var(--foreground)] hover:bg-white",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4 py-2 text-xs",
        lg: "h-12 px-6 py-3 text-sm",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
