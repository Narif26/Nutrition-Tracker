export type ParserMode = "OPENAI" | "OPENAI_REQUIRED";

export function getConfiguredParserMode(): ParserMode {
  return process.env.OPENAI_API_KEY ? "OPENAI" : "OPENAI_REQUIRED";
}

export function getConfiguredParserModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.2";
}
