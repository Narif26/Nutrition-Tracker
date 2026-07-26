import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-2 text-sm text-[color:var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition placeholder:text-[color:var(--muted-foreground)]/70 focus:border-[color:var(--accent)]/40 focus:bg-white",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
