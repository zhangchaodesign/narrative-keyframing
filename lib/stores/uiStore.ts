import { create } from "zustand";

export type ViewMode = "workflow" | "timeline" | "narrative-table";

type UiState = {
  viewMode: ViewMode;
  narrativeTableGroupId?: string;
  setViewMode: (viewMode: ViewMode) => void;
  setNarrativeTableGroupId: (groupId?: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  viewMode: "workflow",
  narrativeTableGroupId: undefined,
  setViewMode: (viewMode) => set({ viewMode }),
  setNarrativeTableGroupId: (groupId) =>
    set({ narrativeTableGroupId: groupId }),
}));
