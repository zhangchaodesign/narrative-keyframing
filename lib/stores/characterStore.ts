import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CoreferenceMatch = {
  sentenceIndex: number;
  startIndex: number; // Index in the whole story
  endIndex: number; // Index in the whole story
  text: string; // The actual coreference text (e.g., "he", "she", "him")
};

export type Character = {
  name: string;
  coreferenceMatches: CoreferenceMatch[];
};

type CharacterState = {
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  updateCharacterCoreferences: (
    characterName: string,
    coreferences: CoreferenceMatch[],
  ) => void;
  clearCharacters: () => void;
};

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      characters: [],
      setCharacters: (characters) => set({ characters }),
      addCharacter: (character) =>
        set((state) => ({ characters: [...state.characters, character] })),
      updateCharacterCoreferences: (characterName, coreferences) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.name === characterName
              ? { ...char, coreferenceMatches: coreferences }
              : char,
          ),
        })),
      clearCharacters: () => set({ characters: [] }),
    }),
    {
      name: "character-storage",
    },
  ),
);
