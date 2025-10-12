import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SentenceCharacterIndicators } from "../types/indicators";

/**
 * Represents a character reference within a sentence (using relative indices)
 */
export type SentenceCharacterRef = {
  text: string; // The coreference text (e.g., "he", "John")
  relativeIndex: number; // Position within the sentence (not absolute story position)
};

/**
 * Cached data for a single sentence
 */
export type SentenceCache = {
  text: string; // The sentence text (used for change detection)
  characterRefs: {
    [characterName: string]: SentenceCharacterRef[]; // Character name → their references in this sentence
  };
  characterIndicators: {
    [characterName: string]: SentenceCharacterIndicators; // Character name → their indicators in this sentence
  };
};

type SentenceCacheState = {
  // Array of sentence caches, indexed by sentence position
  sentenceCaches: SentenceCache[];

  // List of characters this cache was built for
  cachedCharacterNames: string[];

  // Set the entire cache
  setSentenceCaches: (
    caches: SentenceCache[],
    characterNames: string[],
  ) => void;

  // Update a specific sentence cache
  updateSentenceCache: (index: number, cache: SentenceCache) => void;

  // Get cache for a specific sentence index
  getSentenceCache: (index: number) => SentenceCache | undefined;

  // Check if cache is valid for given character list
  isCacheValidForCharacters: (characterNames: string[]) => boolean;

  // Clear all caches
  clearCache: () => void;
};

export const useSentenceCacheStore = create<SentenceCacheState>()(
  persist(
    (set, get) => ({
      sentenceCaches: [],
      cachedCharacterNames: [],

      setSentenceCaches: (caches, characterNames) =>
        set({ sentenceCaches: caches, cachedCharacterNames: characterNames }),

      updateSentenceCache: (index, cache) =>
        set((state) => {
          const newCaches = [...state.sentenceCaches];
          newCaches[index] = cache;
          return { sentenceCaches: newCaches };
        }),

      getSentenceCache: (index) => {
        const state = get();
        return state.sentenceCaches[index];
      },

      isCacheValidForCharacters: (characterNames) => {
        const state = get();
        if (state.cachedCharacterNames.length !== characterNames.length) {
          return false;
        }
        // Check if same characters (order doesn't matter)
        const cachedSet = new Set(state.cachedCharacterNames);
        return characterNames.every((name) => cachedSet.has(name));
      },

      clearCache: () => set({ sentenceCaches: [], cachedCharacterNames: [] }),
    }),
    {
      name: "sentence-cache-storage",
    },
  ),
);
