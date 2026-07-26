import { coreMetricKeys } from "@/lib/nutrition/config";
import {
  clearTodayEntries,
  editFoodEntry,
  removeFoodEntry,
  undoLastFoodAction,
  updateMacroGoals,
  type AgentFoodInput,
} from "@/lib/services/chat-actions";
import {
  extractActionableCommandText,
  parseChatCommand,
} from "@/lib/parser/chat-command";

type LocalAssistantIntent = "ADD" | "EDIT" | "REMOVE" | "UNDO" | "SET_GOALS" | "INFO";

export interface StructuredChatCommand {
  intent: "add" | "remove" | "edit" | "undo" | "clear_today" | "set_goals" | "clarify";
  items: AgentFoodInput[];
  targetText: string | null;
  replacementText: string | null;
  useSuggestedGoals: boolean;
  goalChanges: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  clarificationQuestion: string | null;
}

interface TryHandleChatMessageLocallyInput {
  userId: string;
  message: string;
  timeZone: string;
}

type LocalChatResult =
  | {
      handled: false;
    }
  | {
      handled: true;
      assistantReply: string;
      assistantIntent: LocalAssistantIntent;
    };

export function getActionableChatMessage(message: string) {
  return extractActionableCommandText(message);
}

export async function executeStructuredChatCommand(input: {
  userId: string;
  rawMessage: string;
  timeZone: string;
  command: StructuredChatCommand;
}): Promise<{
  assistantReply: string;
  assistantIntent: LocalAssistantIntent;
}> {
  switch (input.command.intent) {
    case "undo": {
      const result = await undoLastFoodAction(input.userId, input.timeZone);
      return {
        assistantReply: result.message,
        assistantIntent: "UNDO",
      };
    }
    case "clear_today": {
      const result = await clearTodayEntries(input.userId, input.timeZone);
      return {
        assistantReply: result.message,
        assistantIntent: "REMOVE",
      };
    }
    case "remove": {
      if (!input.command.targetText) {
        throw new Error("The remove command is missing targetText.");
      }

      const result = await removeFoodEntry(input.userId, {
        targetText: input.command.targetText,
        timeZone: input.timeZone,
      });

      return {
        assistantReply: result.message,
        assistantIntent: "REMOVE",
      };
    }
    case "edit": {
      if (!input.command.targetText || !input.command.replacementText) {
        throw new Error("The edit command is missing targetText or replacementText.");
      }

      const result = await editFoodEntry(
        input.userId,
        input.rawMessage,
        input.command.targetText,
        input.command.replacementText,
        {
          timeZone: input.timeZone,
        },
      );

      return {
        assistantReply: result.message,
        assistantIntent: "EDIT",
      };
    }
    case "set_goals": {
      const changes = Object.fromEntries(
        Object.entries(input.command.goalChanges).filter(([, value]) => typeof value === "number"),
      ) as Record<string, number>;

      if (!input.command.useSuggestedGoals && Object.keys(changes).length === 0) {
        throw new Error("The goal update command did not include any goal changes.");
      }

      const result = await updateMacroGoals(
        input.userId,
        input.command.useSuggestedGoals ? {} : changes,
        input.timeZone,
      );

      return {
        assistantReply: result.message,
        assistantIntent: "SET_GOALS",
      };
    }
    case "add": {
      throw new Error("Local command execution does not handle add operations.");
    }
    case "clarify":
    default:
      return {
        assistantReply: input.command.clarificationQuestion?.trim() || "Can you clarify that?",
        assistantIntent: "INFO",
      };
  }
}

export async function tryHandleChatMessageLocally(
  input: TryHandleChatMessageLocallyInput,
): Promise<LocalChatResult> {
  const actionableMessage = getActionableChatMessage(input.message);

  if (!actionableMessage) {
    return {
      handled: false,
    };
  }

  const parsed = parseChatCommand(actionableMessage, {
    timeZone: input.timeZone,
  });

  switch (parsed.intent) {
    case "undo": {
      const result = await executeStructuredChatCommand({
        userId: input.userId,
        rawMessage: actionableMessage,
        timeZone: input.timeZone,
        command: {
          intent: "undo",
          items: [],
          targetText: null,
          replacementText: null,
          useSuggestedGoals: false,
          goalChanges: {
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          },
          clarificationQuestion: null,
        },
      });
      return {
        handled: true,
        ...result,
      };
    }
    case "remove": {
      if (!parsed.targetText) {
        return {
          handled: false,
        };
      }

      const result = await executeStructuredChatCommand({
        userId: input.userId,
        rawMessage: actionableMessage,
        timeZone: input.timeZone,
        command: {
          intent: "remove",
          items: [],
          targetText: parsed.targetText,
          replacementText: null,
          useSuggestedGoals: false,
          goalChanges: {
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          },
          clarificationQuestion: null,
        },
      });

      return {
        handled: true,
        ...result,
      };
    }
    case "edit": {
      const result = await executeStructuredChatCommand({
        userId: input.userId,
        rawMessage: actionableMessage,
        timeZone: input.timeZone,
        command: {
          intent: "edit",
          items: [],
          targetText: parsed.targetText,
          replacementText: parsed.replacementText,
          useSuggestedGoals: false,
          goalChanges: {
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          },
          clarificationQuestion: null,
        },
      });

      return {
        handled: true,
        ...result,
      };
    }
    case "set_goals": {
      const changes = Object.fromEntries(
        Object.entries(parsed.changes).filter(([key, value]) =>
          coreMetricKeys.includes(key as (typeof coreMetricKeys)[number]) &&
          typeof value === "number",
        ),
      ) as Record<string, number>;

      if (!parsed.useSuggested && Object.keys(changes).length === 0) {
        return {
          handled: false,
        };
      }

      const result = await executeStructuredChatCommand({
        userId: input.userId,
        rawMessage: actionableMessage,
        timeZone: input.timeZone,
        command: {
          intent: "set_goals",
          items: [],
          targetText: null,
          replacementText: null,
          useSuggestedGoals: parsed.useSuggested,
          goalChanges: {
            calories: changes.calories ?? null,
            protein: changes.protein ?? null,
            carbs: changes.carbs ?? null,
            fat: changes.fat ?? null,
          },
          clarificationQuestion: null,
        },
      });

      return {
        handled: true,
        ...result,
      };
    }
    case "add": {
      return {
        handled: false,
      };
    }
    default:
      return {
        handled: false,
      };
  }
}
