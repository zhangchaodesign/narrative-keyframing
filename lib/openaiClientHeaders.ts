import { OPENAI_API_KEY_HEADER } from "@/lib/openaiApiKeyHeader";
import { useApiKeyStore } from "@/lib/stores/apiKeyStore";

export function getOpenAiApiKeyHeader(): Record<string, string> {
  const apiKey = useApiKeyStore.getState().apiKey;
  return apiKey ? { [OPENAI_API_KEY_HEADER]: apiKey } : {};
}
