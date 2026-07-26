import { Prisma } from "@prisma/client";
import { getLlmTraceFromError, runChatAgent } from "@/lib/ai/openai-command";
import { ensureDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveTimeZone } from "@/lib/date";
import { writePromptTraceMarkdown } from "@/lib/ai/prompt-trace-log";
import { addManualLlmFoodEntries, clearTodayEntries } from "@/lib/services/chat-actions";
import {
  tryHandleChatMessageLocally,
} from "@/lib/services/chat-local";
import { getAppSnapshot } from "@/lib/services/dashboard";

async function logUserMessage(userId: string, content: string) {
  await db.chatMessage.create({
    data: {
      userId,
      role: "USER",
      content,
      intent: "INFO",
    },
  });
}

async function logAssistantMessage(
  userId: string,
  content: string,
  intent: "ADD" | "EDIT" | "REMOVE" | "UNDO" | "SET_GOALS" | "ERROR" | "INFO",
  metadata?: Prisma.InputJsonObject,
) {
  await db.chatMessage.create({
    data: {
      userId,
      role: "ASSISTANT",
      content,
      intent,
      metadata,
    },
  });
}

export async function handleChatMessage(message: string, timeZone?: string | null) {
  const user = await ensureDemoUser();
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const snapshotForAgent = await getAppSnapshot({
    days: 7,
    timeZone: resolvedTimeZone,
  });

  await logUserMessage(user.id, message);

  try {
    const localResult = await tryHandleChatMessageLocally({
      userId: user.id,
      message,
      timeZone: resolvedTimeZone,
    });

    if (localResult.handled) {
      await logAssistantMessage(user.id, localResult.assistantReply, localResult.assistantIntent, {
        parserMode: snapshotForAgent.runtime.parserMode,
        handledBy: "APPLICATION",
      } as Prisma.InputJsonObject);

      return {
        ok: true,
        snapshot: await getAppSnapshot({
          timeZone: resolvedTimeZone,
          parserMode: snapshotForAgent.runtime.parserMode,
        }),
      };
    }

    const agentResult = await runChatAgent({
      message,
      currentState: {
        totals: snapshotForAgent.today.totals,
      },
    });
    if (agentResult.update.intent === "clear_today") {
      await clearTodayEntries(user.id, resolvedTimeZone);
    } else if (agentResult.update.intent === "add") {
      await addManualLlmFoodEntries(
        user.id,
        message,
        agentResult.update.items,
        resolvedTimeZone,
        agentResult.update.updatedTotals,
      );
    }
    const metadata = {
      parserMode: agentResult.parserMode,
      parserModel: agentResult.model,
      updateIntent: agentResult.update.intent,
      llmUpdatedTotals: agentResult.update.updatedTotals,
    } as Prisma.InputJsonObject;

    await writePromptTraceMarkdown(agentResult.trace, {
      message,
      outcome: agentResult.assistantIntent,
    }).catch(() => {
      // Logging should never break the user path.
    });

    await logAssistantMessage(
      user.id,
      agentResult.update.assistantReply,
      agentResult.assistantIntent,
      metadata,
    );

    return {
      ok: true,
      snapshot: await getAppSnapshot({
        timeZone: resolvedTimeZone,
        parserMode: agentResult.parserMode,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "OpenAI could not interpret that message.";
    const llmTrace = getLlmTraceFromError(error);
    const metadata = {
      parserMode: snapshotForAgent.runtime.parserMode,
      parserError: errorMessage,
    } as Prisma.InputJsonObject;

    if (llmTrace) {
      await writePromptTraceMarkdown(llmTrace, {
        message,
        outcome: "error",
      }).catch(() => {
        // Logging should never break the user path.
      });
    }

    await logAssistantMessage(user.id, errorMessage, "ERROR", metadata);

    return {
      ok: false,
      error: errorMessage,
      snapshot: await getAppSnapshot({
        timeZone: resolvedTimeZone,
        parserMode: snapshotForAgent.runtime.parserMode,
      }),
    };
  }
}
