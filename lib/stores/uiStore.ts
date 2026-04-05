import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "workflow" | "timeline" | "table";

type UiState = {
  viewMode: ViewMode;
  narrativeTableGroupId?: string;
  eventCount: number;
  selectedStoryClusterId: string | null;
  selectedNarrativeClusterId: string | null;
  narrativeTableHighlight: boolean;
  setViewMode: (viewMode: ViewMode) => void;
  setNarrativeTableGroupId: (groupId?: string) => void;
  setEventCount: (count: number) => void;
  setSelectedStoryClusterId: (id: string | null) => void;
  setSelectedNarrativeClusterId: (id: string | null) => void;
  setNarrativeTableHighlight: (enabled: boolean) => void;
};

const ENABLE_PERSIST = process.env.NEXT_PUBLIC_ENABLE_PERSIST === "true";

const uiStoreCreator: import("zustand").StateCreator<UiState> = (set) => ({
  viewMode: "timeline",
  narrativeTableGroupId: undefined,
  eventCount: 5,
  selectedStoryClusterId: null,
  selectedNarrativeClusterId: null,
  narrativeTableHighlight: true,
  setViewMode: (viewMode) => set({ viewMode }),
  setNarrativeTableGroupId: (groupId) =>
    set({ narrativeTableGroupId: groupId }),
  setEventCount: (count) => set({ eventCount: count }),
  setSelectedStoryClusterId: (id) => set({ selectedStoryClusterId: id }),
  setSelectedNarrativeClusterId: (id) =>
    set({ selectedNarrativeClusterId: id }),
  setNarrativeTableHighlight: (enabled) =>
    set({ narrativeTableHighlight: enabled }),
});

export const useUiStore = ENABLE_PERSIST
  ? create<UiState>()(persist(uiStoreCreator, { name: "characify-ui-store" }))
  : create<UiState>()(uiStoreCreator);
