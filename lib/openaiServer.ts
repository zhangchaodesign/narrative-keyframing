import { createOpenAI } from "@ai-sdk/openai";
import { OPENAI_API_KEY_HEADER } from "@/lib/openaiApiKeyHeader";

export function getOpenAiProvider(request: Request) {
  const apiKey = request.headers.get(OPENAI_API_KEY_HEADER)?.trim();
  if (!apiKey) {
    return null;
  }
  return createOpenAI({ apiKey });
}
