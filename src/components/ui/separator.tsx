"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
}: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative
      orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full bg-[color:var(--border)]"
          : "h-full w-px bg-[color:var(--border)]",
        className,
      )}
    />
  );
}
