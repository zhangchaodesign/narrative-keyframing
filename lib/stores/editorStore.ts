// store/editorStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Descendant } from "slate";
import { SlateUtils, type SlateTextSegment } from "../utiils/slateUtils";

export type Match = { start: number; end: number };

type PendingSuggestion = {
  conflictId: string;
  originalValue: Descendant[];
  originalText: string;
  resolvedText: string;
  sentenceStart: number;
  originalSentence: string;
  revisedSentence: string;
  sentenceIndex: number;
};

type SuggestionPayload = {
  conflictId: string;
  sentenceStart: number;
  originalSentence: string;
  revisedSentence: string;
  diffSegments: SlateTextSegment[];
  sentenceIndex: number;
};

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

  suggestion: PendingSuggestion | null;
  beginSuggestion: (payload: SuggestionPayload) => void;
  applySuggestion: () => void;
  clearSuggestion: () => void;
};

const cloneValue = (value: Descendant[]): Descendant[] =>
  JSON.parse(JSON.stringify(value));

const ENABLE_PERSIST =
  process.env.NEXT_PUBLIC_ENABLE_PERSIST === "true";

const editorStoreCreator: import("zustand").StateCreator<EditorState> = (set) => ({
  value: [{ type: "paragraph", children: [{ text: "Type here..." }] }],
  setValue: (v: Descendant[]) => set({ value: v }),
  isReadOnly: false,
  setReadOnly: (b: boolean) => set({ isReadOnly: b }),
  matches: [] as Match[],
  setMatches: (m: Match[]) => set({ matches: m }),
  filter: null as [number, number] | null,
  setFilter: (f: [number, number] | null) => set({ filter: f }),
  suggestion: null as PendingSuggestion | null,
  beginSuggestion: (payload: SuggestionPayload) =>
    set((state: EditorState) => {
      const baseValue = state.suggestion
        ? cloneValue(state.suggestion.originalValue)
        : cloneValue(state.value);
      const baseText = state.suggestion
        ? state.suggestion.originalText
        : SlateUtils.stateToText(baseValue as any);

      const prefix = baseText.slice(0, payload.sentenceStart);
      const suffix = baseText.slice(
        payload.sentenceStart + payload.originalSentence.length,
      );

      const segments: SlateTextSegment[] = [
        { text: prefix },
        ...payload.diffSegments,
        { text: suffix },
      ];

      const previewValue = SlateUtils.segmentsToSlateState(segments);

      return {
        value: previewValue,
        suggestion: {
          conflictId: payload.conflictId,
          originalValue: baseValue,
          originalText: baseText,
          resolvedText: prefix + payload.revisedSentence + suffix,
          sentenceStart: payload.sentenceStart,
          originalSentence: payload.originalSentence,
          revisedSentence: payload.revisedSentence,
          sentenceIndex: payload.sentenceIndex,
        },
      };
    }),
  applySuggestion: () =>
    set((state: EditorState) => {
      if (!state.suggestion) return state;
      return {
        value: SlateUtils.textToSlateState(state.suggestion.resolvedText),
        suggestion: null,
      };
    }),
  clearSuggestion: () =>
    set((state: EditorState) => {
      if (!state.suggestion) return state;
      return {
        value: cloneValue(state.suggestion.originalValue),
        suggestion: null,
      };
    }),
});

export const useEditorStore = ENABLE_PERSIST
  ? create<EditorState>()(
      persist(editorStoreCreator, { name: "editor-storage" }),
    )
  : create<EditorState>()(editorStoreCreator);
