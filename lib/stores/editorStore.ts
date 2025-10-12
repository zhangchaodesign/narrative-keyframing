// store/editorStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Descendant } from "slate";

export type Match = { start: number; end: number };

type EditorState = {
  value: Descendant[];
  setValue: (v: Descendant[]) => void;

  isReadOnly: boolean;
  setReadOnly: (b: boolean) => void;

  // placeholders you can wire later
  matches: Match[];
  setMatches: (m: Match[]) => void;

  // general-purpose filter window [start,end] or null
  filter: [number, number] | null;
  setFilter: (f: [number, number] | null) => void;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      value: [],
      setValue: (v) => set({ value: v }),
      isReadOnly: false,
      setReadOnly: (b) => set({ isReadOnly: b }),
      matches: [],
      setMatches: (m) => set({ matches: m }),
      filter: null,
      setFilter: (f) => set({ filter: f }),
    }),
    {
      name: "editor-storage",
    },
  ),
);
