import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LlmTrace } from "@/lib/ai/openai-command";

function stringify(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "trace";
}

function buildMarkdown(trace: LlmTrace, meta: { message: string; outcome: string }) {
  return [
    "# NutriChat LLM Trace",
    "",
    "## Meta",
    "",
    `- Requested at: ${trace.requestedAt}`,
    `- Model: ${trace.model}`,
    `- Outcome: ${meta.outcome}`,
    `- User message: ${meta.message}`,
    `- Web search enabled: ${trace.webSearch.enabled ? "yes" : "no"}`,
    `- Web search mode: ${trace.webSearch.mode}`,
    `- Web search reason: ${trace.webSearch.reason ?? "n/a"}`,
    `- Web search context size: ${trace.webSearch.searchContextSize ?? "n/a"}`,
    trace.webSearch.enabled
      ? trace.webSearch.allowedDomains.length > 0
        ? `- Web search allowed domains: ${trace.webSearch.allowedDomains.join(", ")}`
        : "- Web search allowed domains: all"
      : "- Web search allowed domains: n/a",
    `- Input tokens: ${trace.tokenUsage.totals.inputTokens}`,
    `- Output tokens: ${trace.tokenUsage.totals.outputTokens}`,
    `- Total tokens: ${trace.tokenUsage.totals.totalTokens}`,
    `- Cached input tokens: ${trace.tokenUsage.totals.cachedInputTokens}`,
    `- Reasoning tokens: ${trace.tokenUsage.totals.reasoningTokens}`,
    trace.error ? `- Error: ${trace.error}` : "- Error: none",
    "",
    "## Token Usage",
    "",
    trace.tokenUsage.steps.length > 0
      ? trace.tokenUsage.steps
          .map(
            (step) =>
              `- Step ${step.step}: input=${step.inputTokens}, output=${step.outputTokens}, total=${step.totalTokens}, cached_input=${step.cachedInputTokens}, reasoning=${step.reasoningTokens}`,
          )
          .join("\n")
      : "- No token usage was reported by the API.",
    "",
    "## System Prompt",
    "",
    "```text",
    trace.systemPrompt,
    "```",
    "",
    "## User Payload",
    "",
    "```json",
    stringify(trace.userPayload),
    "```",
    "",
    "## Request Body",
    "",
    "```json",
    stringify(trace.requestBody),
    "```",
    "",
    "## Response Body",
    "",
    "```json",
    stringify(trace.responseBody) || "{}",
    "```",
    "",
  ].join("\n");
}

export async function writePromptTraceMarkdown(
  trace: LlmTrace,
  meta: { message: string; outcome: string },
) {
  const root = path.join(process.cwd(), "logs", "llm-prompts");
  const day = trace.requestedAt.slice(0, 10);
  const dayDir = path.join(root, day);
  const timestamp = trace.requestedAt.replace(/[:.]/g, "-");
  const slug = slugify(meta.message);
  const filename = `${timestamp}-${meta.outcome}-${slug}.md`;
  const markdown = buildMarkdown(trace, meta);

  await mkdir(dayDir, { recursive: true });
  await writeFile(path.join(dayDir, filename), markdown, "utf8");
  await writeFile(path.join(root, "latest.md"), markdown, "utf8");
}
