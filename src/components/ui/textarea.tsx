import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[120px] w-full rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm text-[color:var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition placeholder:text-[color:var(--muted-foreground)]/70 focus:border-[color:var(--accent)]/40 focus:bg-white",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
