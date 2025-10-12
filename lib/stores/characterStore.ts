import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CharacterIndicators } from "../types/indicators";
import { CharacterAttribute } from "../types/attributes";

export type CoreferenceMatch = {
  sentenceIndex: number;
  startIndex: number; // Index in the whole story
  endIndex: number; // Index in the whole story
  text: string; // The actual coreference text (e.g., "he", "she", "him")
};

export type Character = {
  name: string;
  coreferenceMatches: CoreferenceMatch[];
  indicatorMatches: CharacterIndicators; // OLD indicator system
  attributes: CharacterAttribute[]; // NEW attribute system
};

type CharacterState = {
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  updateCharacterCoreferences: (
    characterName: string,
    coreferences: CoreferenceMatch[],
  ) => void;
  updateCharacterIndicators: (
    characterName: string,
    indicators: CharacterIndicators,
  ) => void;
  updateCharacterAttributes: (
    characterName: string,
    attributes: CharacterAttribute[],
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
      updateCharacterIndicators: (characterName, indicators) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.name === characterName
              ? { ...char, indicatorMatches: indicators }
              : char,
          ),
        })),
      updateCharacterAttributes: (characterName, attributes) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.name === characterName ? { ...char, attributes } : char,
          ),
        })),
      clearCharacters: () => set({ characters: [] }),
    }),
    {
      name: "character-storage",
    },
  ),
);
