"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="glass-panel rounded-[32px] p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          Something broke
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
          NutriChat hit an unexpected error.
        </h1>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
          {error.message}
        </p>
        <div className="mt-6">
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
