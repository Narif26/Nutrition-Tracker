"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { BellDot, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppSnapshot, ChatMessageView, SettingsPayload } from "@/types/app";

export function NutriChatApp({
  initialSnapshot,
}: {
  initialSnapshot: AppSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [browserTimeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [settingsOpen, setSettingsOpen] = useState(!initialSnapshot.profile.isComplete);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<ChatMessageView | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const messages = optimisticMessage
    ? [...snapshot.messages, optimisticMessage]
    : snapshot.messages;

  const refreshSnapshot = useEffectEvent(async () => {
    const response = await fetch(
      `/api/snapshot?timeZone=${encodeURIComponent(browserTimeZone)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Could not refresh the dashboard.");
    }

    setSnapshot(payload.snapshot);
  });

  const refreshSnapshotWithRetry = useEffectEvent(async () => {
    await refreshSnapshot();

    await new Promise((resolve) => {
      window.setTimeout(resolve, 180);
    });

    await refreshSnapshot();
  });

  function pushNetworkError(message: string) {
    setTransportError(message);
    setSnapshot((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `client-error-${Date.now()}`,
          role: "ASSISTANT",
          intent: "ERROR",
          content: message,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }

  useEffect(() => {
    if (initialSnapshot.runtime.timeZone === browserTimeZone) {
      return;
    }

    void refreshSnapshot().catch(() => {
      // Leave the server-rendered snapshot in place if the background sync fails.
    });
  }, [browserTimeZone, initialSnapshot.runtime.timeZone]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshSnapshot().catch(() => {
        setTransportError("Could not refresh the latest dashboard state.");
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNextRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 2, 0);

      timeoutId = window.setTimeout(() => {
        void refreshSnapshot()
          .catch(() => {
            setTransportError("Could not refresh the dashboard for the new day.");
          })
          .finally(scheduleNextRefresh);
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleNextRefresh();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [browserTimeZone]);

  function handleSendMessage(message: string) {
    setTransportError(null);

    const pendingMessage: ChatMessageView = {
      id: `optimistic-${Date.now()}`,
      role: "USER",
      intent: "ADD",
      content: message,
      createdAt: new Date().toISOString(),
    };

    setOptimisticMessage(pendingMessage);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              message,
              timeZone: browserTimeZone,
            }),
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.error ?? "Could not send that message.");
          }

          setSnapshot(payload.snapshot);

          await refreshSnapshotWithRetry();

          if (!payload.ok) {
            setTransportError(payload.error ?? "Some items could not be processed.");
          }
        } catch (error) {
          pushNetworkError(
            error instanceof Error
              ? error.message
              : "Could not send that message.",
          );
        } finally {
          setOptimisticMessage(null);
        }
      })();
    });
  }

  async function handleSaveSettings(payload: SettingsPayload) {
    setTransportError(null);

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        timeZone: browserTimeZone,
      }),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? "Could not save settings.");
    }

    setSnapshot(result.snapshot);
    setSettingsOpen(false);
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="glass-panel mb-6 flex flex-col gap-6 rounded-[32px] px-6 py-6 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">USDA-ready</Badge>
                <Badge>Postgres + Prisma</Badge>
                <Badge variant="warm">Demo auth</Badge>
                <Badge variant={snapshot.runtime.parserMode === "OPENAI" ? "accent" : "warm"}>
                  {snapshot.runtime.parserMode === "OPENAI"
                    ? snapshot.runtime.model
                    : `${snapshot.runtime.model} required`}
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-5xl">
                  NutriChat
                </h1>
                <p className="max-w-3xl text-sm text-[color:var(--muted-foreground)] sm:text-base">
                  A full-stack nutrition tracker with a conversational logging
                  flow, live calorie and macro totals, and a rolling calorie
                  history chart.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/72 px-4 py-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  <BellDot className="h-4 w-4" />
                  Live log
                </div>
                <p className="mt-2 text-xl font-semibold">
                  {snapshot.today.entries.length} entries today
                </p>
              </div>
              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/72 px-4 py-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  <ShieldCheck className="h-4 w-4" />
                  Source-aware
                </div>
                <p className="mt-2 text-xl font-semibold">Metadata preserved</p>
              </div>
              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/72 px-4 py-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Goals
                </div>
                <Button
                  className="mt-3 w-full"
                  onClick={() => setSettingsOpen(true)}
                  type="button"
                  variant="outline"
                >
                  Open settings
                </Button>
              </div>
            </div>
          </div>

          {transportError ? (
            <div className="rounded-[22px] border border-[#d8b5a0] bg-[#fff3ea] px-4 py-3 text-sm text-[#8c4c23]">
              {transportError}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <ChatPanel messages={messages} onSendMessage={handleSendMessage} pending={isPending} />
          <DashboardPanel onOpenSettings={() => setSettingsOpen(true)} snapshot={snapshot} />
        </div>
      </div>

      <SettingsDialog
        goals={snapshot.goals}
        key={`${snapshot.generatedAt}-${settingsOpen ? "open" : "closed"}`}
        onOpenChange={setSettingsOpen}
        onSave={handleSaveSettings}
        open={settingsOpen}
        profile={snapshot.profile}
        saving={isPending}
      />
    </div>
  );
}
