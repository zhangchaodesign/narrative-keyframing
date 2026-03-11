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

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      viewMode: "workflow",
      narrativeTableGroupId: undefined,
      eventCount: 4,
      setViewMode: (viewMode) => set({ viewMode }),
      setNarrativeTableGroupId: (groupId) =>
        set({ narrativeTableGroupId: groupId }),
      setEventCount: (count) => set({ eventCount: count }),
    }),
    { name: "characify-ui-store" },
  ),
);
