import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "workflow" | "timeline" | "narrative-table";

type UiState = {
  viewMode: ViewMode;
  narrativeTableGroupId?: string;
  eventCount: number;
  setViewMode: (viewMode: ViewMode) => void;
  setNarrativeTableGroupId: (groupId?: string) => void;
  setEventCount: (count: number) => void;
};

const ENABLE_PERSIST =
  process.env.NEXT_PUBLIC_ENABLE_PERSIST === "true";

const uiStoreCreator: import("zustand").StateCreator<UiState> = (set) => ({
  viewMode: "timeline",
  narrativeTableGroupId: undefined,
  eventCount: 3,
  setViewMode: (viewMode) => set({ viewMode }),
  setNarrativeTableGroupId: (groupId) =>
    set({ narrativeTableGroupId: groupId }),
  setEventCount: (count) => set({ eventCount: count }),
});

export const useUiStore = ENABLE_PERSIST
  ? create<UiState>()(
      persist(uiStoreCreator, { name: "characify-ui-store" }),
    )
  : create<UiState>()(uiStoreCreator);
