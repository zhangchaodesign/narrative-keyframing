import { create } from "zustand";
import { persist } from "zustand/middleware";

type ApiKeyState = {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
};

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (apiKey: string) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: "" }),
    }),
    { name: "narrative-keyframing-openai-key" },
  ),
);
