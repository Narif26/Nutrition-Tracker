"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn, clamp } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--track)]",
        className,
      )}
      value={value}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-warm))] transition-all",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - clamp(value, 0, 100)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
