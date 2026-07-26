import OpenAI from "openai";
import { z } from "zod";
import { coreMetricKeys } from "@/lib/nutrition/config";
import { extractActionableCommandText } from "@/lib/parser/chat-command";
import { getConfiguredParserModel, type ParserMode } from "@/lib/ai/runtime";
import type { LlmLoggedFoodItem } from "@/lib/services/chat-actions";
import type { NutritionRecord } from "@/types/nutrition";

type AssistantIntent = "ADD" | "EDIT" | "REMOVE" | "UNDO" | "SET_GOALS" | "INFO";

export interface LlmTrace {
  requestedAt: string;
  model: string;
  systemPrompt: string;
  userPayload: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  responseBody: unknown | null;
  error: string | null;
  tokenUsage: {
    totals: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cachedInputTokens: number;
      reasoningTokens: number;
    };
    steps: Array<{
      step: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cachedInputTokens: number;
      reasoningTokens: number;
    }>;
  };
  webSearch: {
    enabled: boolean;
    mode: "off";
    reason: string | null;
    searchContextSize: null;
    allowedDomains: string[];
  };
}

interface RunChatAgentInput {
  message: string;
  currentState: {
    totals: NutritionRecord;
  };
}

export interface LlmNutritionUpdate {
  assistantReply: string;
  intent: "add" | "clear_today" | "clarify";
  items: LlmLoggedFoodItem[];
  updatedTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  clarificationQuestion: string | null;
}

interface RunChatAgentResult {
  update: LlmNutritionUpdate;
  assistantIntent: AssistantIntent;
  parserMode: ParserMode;
  model: string;
  trace: LlmTrace;
}

class OpenAiAgentError extends Error {
  trace: LlmTrace;

  constructor(message: string, trace: LlmTrace) {
    super(message);
    this.name = "OpenAiAgentError";
    this.trace = trace;
  }
}

const llmFoodItemSchema = z.object({
  description: z.string().trim().min(1).max(160),
  quantityText: z.string().trim().min(1).max(80),
  amount: z.number().positive().max(1000).nullable(),
  unit: z.string().trim().min(1).max(40).nullable(),
  nutrients: z.object({
    calories: z.number().min(0).max(10000),
    protein: z.number().min(0).max(10000),
    carbs: z.number().min(0).max(10000),
    fat: z.number().min(0).max(10000),
  }),
});

const llmNutritionUpdateSchema = z.object({
  assistantReply: z.string().trim().min(1).max(400),
  intent: z.enum(["add", "clear_today", "clarify"]),
  items: z.array(llmFoodItemSchema).max(8),
  updatedTotals: z.object({
    calories: z.number().min(0).max(100000),
    protein: z.number().min(0).max(100000),
    carbs: z.number().min(0).max(100000),
    fat: z.number().min(0).max(100000),
  }),
  clarificationQuestion: z.string().trim().max(240).nullable(),
});

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantReply: { type: "string" },
    intent: {
      type: "string",
      enum: ["add", "clear_today", "clarify"],
    },
    items: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantityText: { type: "string" },
          amount: { anyOf: [{ type: "number" }, { type: "null" }] },
          unit: { anyOf: [{ type: "string" }, { type: "null" }] },
          nutrients: {
            type: "object",
            additionalProperties: false,
            properties: {
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
            required: ["calories", "protein", "carbs", "fat"],
          },
        },
        required: ["description", "quantityText", "amount", "unit", "nutrients"],
      },
    },
    updatedTotals: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
    clarificationQuestion: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["assistantReply", "intent", "items", "updatedTotals", "clarificationQuestion"],
} as const;

function getBaseUrl() {
  return (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
}

function getTimeoutMs() {
  const configured = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? "20000", 10);

  if (Number.isFinite(configured) && configured >= 1000) {
    return configured;
  }

  return 20000;
}

function getClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: getBaseUrl(),
    timeout: getTimeoutMs(),
  });
}

export function getLlmTraceFromError(error: unknown) {
  if (error instanceof OpenAiAgentError) {
    return error.trace;
  }

  return null;
}

function buildSystemPrompt() {
  return [
    "You are NutriChat's nutrition update engine.",
    "You receive only current day calorie and macro totals plus the latest user message.",
    "If the user is logging food, estimate each food item's calories, protein, carbs, and fat, then return the new updated totals.",
    "If the user wants to start a new day or clear today's metrics, return intent clear_today with all updated totals set to zero.",
    "If the request is too ambiguous, return intent clarify with a short clarificationQuestion.",
    "Return concise conversational assistantReply text with no markdown.",
    "Do not mention missing context or hidden assumptions.",
    "Return only JSON matching the schema.",
  ].join("\n");
}

function buildUserPayload(input: RunChatAgentInput) {
  const actionableMessage = extractActionableCommandText(input.message) || input.message;

  return {
    currentDayMetrics: Object.fromEntries(
      coreMetricKeys.map((key) => [key, input.currentState.totals[key]]),
    ),
    message: actionableMessage,
  };
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      if ("content" in item && Array.isArray(item.content)) {
        return item.content.flatMap((contentItem: unknown) => {
          if (!contentItem || typeof contentItem !== "object") {
            return [];
          }

          if ("text" in contentItem && typeof contentItem.text === "string") {
            return [contentItem.text];
          }

          return [];
        });
      }

      return [];
    })
    .join("")
    .trim();
}

function extractUsage(payload: Record<string, unknown>) {
  const usage =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : {};
  const inputDetails =
    usage.input_tokens_details && typeof usage.input_tokens_details === "object"
      ? (usage.input_tokens_details as Record<string, unknown>)
      : {};
  const outputDetails =
    usage.output_tokens_details && typeof usage.output_tokens_details === "object"
      ? (usage.output_tokens_details as Record<string, unknown>)
      : {};

  const coerce = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    inputTokens: coerce(usage.input_tokens),
    outputTokens: coerce(usage.output_tokens),
    totalTokens: coerce(usage.total_tokens),
    cachedInputTokens: coerce(inputDetails.cached_tokens),
    reasoningTokens: coerce(outputDetails.reasoning_tokens),
  };
}

function parseNutritionUpdate(payload: Record<string, unknown>) {
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI did not return a structured nutrition update.");
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(outputText);
  } catch {
    throw new Error("OpenAI returned invalid JSON for the nutrition update schema.");
  }

  return llmNutritionUpdateSchema.parse(parsedJson);
}

function inferAssistantIntent(update: LlmNutritionUpdate): AssistantIntent {
  switch (update.intent) {
    case "add":
      return "ADD";
    case "clear_today":
      return "REMOVE";
    default:
      return "INFO";
  }
}

async function callOpenAiAgent(input: RunChatAgentInput) {
  const model = getConfiguredParserModel();
  const systemPrompt = buildSystemPrompt();
  const userPayload = buildUserPayload(input);
  const traceBase: LlmTrace = {
    requestedAt: new Date().toISOString(),
    model,
    systemPrompt,
    userPayload,
    requestBody: {},
    responseBody: null,
    error: null,
    tokenUsage: {
      totals: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
      steps: [],
    },
    webSearch: {
      enabled: false,
      mode: "off",
      reason: "disabled_by_design",
      searchContextSize: null,
      allowedDomains: [],
    },
  };
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new OpenAiAgentError(
      "OpenAI is not configured. Add OPENAI_API_KEY to .env before using chat.",
      {
        ...traceBase,
        error: "missing_api_key",
      },
    );
  }

  const requestBody: Record<string, unknown> = {
    model,
    instructions: systemPrompt,
    input: JSON.stringify(userPayload),
    reasoning: {
      effort: "low",
    },
    text: {
      format: {
        type: "json_schema",
        name: "nutrichat_nutrition_update",
        strict: true,
        schema: responseSchema,
      },
    },
    max_output_tokens: 420,
  };

  try {
    const client = getClient(apiKey);
    const response = (await client.responses.create(requestBody as never)) as unknown as Record<
      string,
      unknown
    >;
    const usage = extractUsage(response);
    const update = parseNutritionUpdate(response) as LlmNutritionUpdate;

    return {
      model,
      update,
      assistantIntent: inferAssistantIntent(update),
      trace: {
        ...traceBase,
        requestBody: { steps: [requestBody] },
        responseBody: { steps: [{ response, usage, update }] },
        tokenUsage: {
          totals: usage,
          steps: [{ step: 1, ...usage }],
        },
      },
    };
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : null;
    const message =
      error instanceof Error ? error.message : "OpenAI nutrition update failed unexpectedly.";
    const errorMessage =
      status === 401
        ? "OpenAI authentication failed. The OPENAI_API_KEY in .env is invalid, expired, or tied to a different project. Replace it and restart the app."
        : status === 429
          ? "OpenAI quota exceeded. Check your API plan, usage, and billing, then try again after quota is available."
          : message;

    throw new OpenAiAgentError(errorMessage, {
      ...traceBase,
      requestBody: { steps: [requestBody] },
      responseBody: null,
      error: errorMessage,
    });
  }
}

export async function runChatAgent(
  input: RunChatAgentInput,
): Promise<RunChatAgentResult> {
  const result = await callOpenAiAgent(input);

  return {
    update: result.update,
    assistantIntent: result.assistantIntent,
    parserMode: "OPENAI",
    model: result.model,
    trace: result.trace,
  };
}
