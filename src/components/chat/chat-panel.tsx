"use client";

import { format } from "date-fns";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUpRight, LoaderCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessageView } from "@/types/app";
import { cn } from "@/lib/utils";

export function ChatPanel({
  messages,
  pending,
  onSendMessage,
}: {
  messages: ChatMessageView[];
  pending: boolean;
  onSendMessage: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages = messages.slice(-10);
  const scrollToBottom = useEffectEvent(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  useEffect(() => {
    scrollToBottom();
  }, [visibleMessages.length, pending]);

  function submitMessage(message: string) {
    const normalized = message.trim();

    if (!normalized) {
      return;
    }

    setInput("");
    onSendMessage(normalized);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(input);
    }
  }

  return (
    <Card className="flex h-[760px] max-h-[calc(100vh-2rem)] min-h-[620px] flex-col overflow-hidden p-0">
      <div className="hero-shell relative overflow-hidden rounded-t-[28px] px-6 py-6 text-white sm:px-7">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="warm" className="bg-white/14 text-white">
              Chat-first logging
            </Badge>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-[2.2rem]">
              Tell NutriChat what you ate.
            </h2>
            <p className="max-w-xl text-sm text-white/82 sm:text-base">
              Add foods, fix mistakes, remove items, or update goals with plain
              English. Your dashboard refreshes live.
            </p>
          </div>
          <div className="hidden rounded-full border border-white/16 bg-white/10 p-3 lg:block">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 pb-5 pt-5 sm:px-6">
        <CardHeader className="mb-0 px-1">
          <CardTitle className="text-lg">Today&apos;s conversation</CardTitle>
          <CardDescription>Showing the latest 10 messages.</CardDescription>
        </CardHeader>

        <div
          ref={scrollRef}
          className="soft-grid flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.55)] px-4 py-4 sm:px-5"
        >
          {visibleMessages.map((message) => {
            const isUser = message.role === "USER";

            return (
              <div
                key={message.id}
                className={cn("flex animate-enter", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_14px_34px_rgba(23,35,41,0.08)]",
                    isUser
                      ? "chat-bubble-user text-white"
                      : "chat-bubble-assistant text-[color:var(--foreground)]",
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  <div
                    className={cn(
                      "mt-2 text-[11px] uppercase tracking-[0.18em]",
                      isUser ? "text-white/74" : "text-[color:var(--muted-foreground)]",
                    )}
                  >
                    {isUser ? "You" : "NutriChat"} - {format(new Date(message.createdAt), "h:mm a")}
                  </div>
                </div>
              </div>
            );
          })}

          {pending ? (
            <div className="flex animate-enter justify-start">
              <div className="chat-bubble-assistant inline-flex items-center gap-2 rounded-[24px] px-4 py-3 text-sm text-[color:var(--foreground)] shadow-[0_14px_34px_rgba(23,35,41,0.08)]">
                <LoaderCircle className="h-4 w-4 animate-spin text-[color:var(--accent)]" />
                Updating your log and totals...
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-[color:var(--border)] bg-white/78 p-3 shadow-[0_18px_44px_rgba(23,35,41,0.06)]">
          <Textarea
            className="min-h-[120px] resize-none border-0 bg-transparent p-2 shadow-none focus:border-0 focus:bg-transparent"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a food, edit, remove, or goal update..."
            value={input}
          />

          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] px-2 pt-3">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Press Enter to send. Shift + Enter adds a line break.
            </p>
            <Button
              className="min-w-[132px]"
              disabled={pending || !input.trim()}
              onClick={() => submitMessage(input)}
              type="button"
            >
              {pending ? "Working..." : "Send"}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
