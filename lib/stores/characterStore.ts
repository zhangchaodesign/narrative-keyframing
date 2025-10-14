import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CharacterIndicators } from "../types/indicators";
import { CharacterAttribute } from "../types/attributes";
import { AttributeConflict } from "../types/conflicts";

export type CoreferenceMatch = {
  sentenceIndex: number;
  startIndex: number; // Index in the whole story
  endIndex: number; // Index in the whole story
  text: string; // The actual coreference text (e.g., "he", "she", "him")
};

export type CharacterSource = "manual" | "ai-extracted";

export type Character = {
  name: string;
  source: CharacterSource; // Track whether manually created or AI extracted
  coreferenceMatches: CoreferenceMatch[];
  indicatorMatches: CharacterIndicators; // OLD indicator system
  attributes: CharacterAttribute[]; // NEW attribute system
  conflicts: AttributeConflict[]; // Detected inconsistencies in characterization
};

type CharacterState = {
  version: number; // For data migration
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
  updateCharacterConflicts: (
    characterName: string,
    conflicts: AttributeConflict[],
  ) => void;
  removeSentenceData: (sentenceIndex: number) => void;
  shiftIndicesAfterSentenceChange: (
    sentenceIndex: number,
    sentenceStart: number,
    originalLength: number,
    newLength: number,
  ) => void;
  clearCharacters: () => void;

  // Manual character management
  createManualCharacter: (name: string) => void;
  removeCharacter: (name: string) => void;
  updateCharacterName: (oldName: string, newName: string) => void;

  // Manual attribute management
  addAttributeToCharacter: (
    characterName: string,
    category: string,
    value: string,
  ) => void;
  removeAttributeFromCharacter: (
    characterName: string,
    category: string,
    value: string,
  ) => void;
};

const DEFAULT_CATEGORIES = ["physiology", "psychology", "sociology"];

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      version: 2,
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
      updateCharacterConflicts: (characterName, conflicts) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.name === characterName ? { ...char, conflicts } : char,
          ),
        })),
      removeSentenceData: (sentenceIndex) =>
        set((state) => ({
          characters: state.characters.map((char) => {
            const filteredCorefs = char.coreferenceMatches.filter(
              (match) => match.sentenceIndex !== sentenceIndex,
            );

            const filterIndicators = <T extends { sentenceIndex: number }>(
              matches: T[],
            ): T[] =>
              matches.filter((match) => match.sentenceIndex !== sentenceIndex);

            const filteredIndicators: CharacterIndicators = {
              directDefinition: filterIndicators(
                char.indicatorMatches.directDefinition,
              ),
              actions: filterIndicators(char.indicatorMatches.actions),
              speech: filterIndicators(char.indicatorMatches.speech),
              appearance: filterIndicators(char.indicatorMatches.appearance),
              environment: filterIndicators(char.indicatorMatches.environment),
            };

            const filteredAttributes = char.attributes.map((attr) => ({
              ...attr,
              evidence: attr.evidence.filter(
                (ev) => ev.sentenceIndex !== sentenceIndex,
              ),
            }));

            const filteredConflicts = char.conflicts.filter(
              (conflict) =>
                conflict.conflictingEvidence.sentenceIndex !== sentenceIndex &&
                conflict.establishedAttribute.evidence.sentenceIndex !==
                  sentenceIndex,
            );

            return {
              ...char,
              coreferenceMatches: filteredCorefs,
              indicatorMatches: filteredIndicators,
              attributes: filteredAttributes,
              conflicts: filteredConflicts,
            };
          }),
        })),
      shiftIndicesAfterSentenceChange: (
        sentenceIndex,
        sentenceStart,
        originalLength,
        newLength,
      ) =>
        set((state) => {
          const delta = newLength - originalLength;
          if (delta === 0) return state;
          const changeEnd = sentenceStart + originalLength;

          const adjustRange = (
            start: number,
            end: number,
            rangeSentenceIndex: number,
          ) => {
            if (rangeSentenceIndex > sentenceIndex) {
              return { start: start + delta, end: end + delta };
            }
            if (
              rangeSentenceIndex === sentenceIndex &&
              start >= changeEnd
            ) {
              return { start: start + delta, end: end + delta };
            }
            return { start, end };
          };

          const adjustMatches = (matches: CoreferenceMatch[]) =>
            matches.map((match) => {
              const { start, end } = adjustRange(
                match.startIndex,
                match.endIndex,
                match.sentenceIndex,
              );
              if (
                start !== match.startIndex ||
                end !== match.endIndex
              ) {
                return { ...match, startIndex: start, endIndex: end };
              }
              return match;
            });

          const adjustEvidenceList = <T extends {
            startIndex: number;
            endIndex: number;
            sentenceIndex: number;
          }>(evidence: T[]): T[] =>
            evidence.map((ev) => {
              const { start, end } = adjustRange(
                ev.startIndex,
                ev.endIndex,
                ev.sentenceIndex,
              );
              if (start !== ev.startIndex || end !== ev.endIndex) {
                return { ...ev, startIndex: start, endIndex: end };
              }
              return ev;
            });

          const adjustIndicators = (
            indicators: CharacterIndicators,
          ): CharacterIndicators => ({
            directDefinition: adjustEvidenceList(indicators.directDefinition),
            actions: adjustEvidenceList(indicators.actions),
            speech: adjustEvidenceList(indicators.speech),
            appearance: adjustEvidenceList(indicators.appearance),
            environment: adjustEvidenceList(indicators.environment),
          });

          const adjustedCharacters = state.characters.map((char) => {
            const updatedCorefs = adjustMatches(char.coreferenceMatches);
            const updatedIndicators = adjustIndicators(char.indicatorMatches);
            const updatedAttributes = char.attributes.map((attr) => ({
              ...attr,
              evidence: adjustEvidenceList(attr.evidence),
            }));
            const updatedConflicts = char.conflicts.map((conflict) => {
              const established = adjustRange(
                conflict.establishedAttribute.evidence.startIndex,
                conflict.establishedAttribute.evidence.endIndex,
                conflict.establishedAttribute.evidence.sentenceIndex,
              );
              const conflicting = adjustRange(
                conflict.conflictingEvidence.startIndex,
                conflict.conflictingEvidence.endIndex,
                conflict.conflictingEvidence.sentenceIndex,
              );
              return {
                ...conflict,
                establishedAttribute: {
                  ...conflict.establishedAttribute,
                  evidence: {
                    ...conflict.establishedAttribute.evidence,
                    startIndex: established.start,
                    endIndex: established.end,
                  },
                },
                conflictingEvidence: {
                  ...conflict.conflictingEvidence,
                  startIndex: conflicting.start,
                  endIndex: conflicting.end,
                },
              };
            });

            return {
              ...char,
              coreferenceMatches: updatedCorefs,
              indicatorMatches: updatedIndicators,
              attributes: updatedAttributes,
              conflicts: updatedConflicts,
            };
          });

          return { characters: adjustedCharacters };
        }),
      clearCharacters: () => set({ characters: [] }),

      // Manual character management
      createManualCharacter: (name: string) =>
        set((state) => {
          // Check if character already exists
          if (state.characters.some((c) => c.name === name)) {
            return state;
          }

          const newCharacter: Character = {
            name,
            source: "manual",
            coreferenceMatches: [],
            indicatorMatches: {
              directDefinition: [],
              actions: [],
              speech: [],
              appearance: [],
              environment: [],
            },
            attributes: [],
            conflicts: [],
          };

          return { characters: [...state.characters, newCharacter] };
        }),

      removeCharacter: (name: string) =>
        set((state) => ({
          characters: state.characters.filter((c) => c.name !== name),
        })),

      updateCharacterName: (oldName: string, newName: string) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.name === oldName ? { ...char, name: newName } : char,
          ),
        })),

      // Manual attribute management
      addAttributeToCharacter: (
        characterName: string,
        category: string,
        value: string,
      ) =>
        set((state) => ({
          characters: state.characters.map((char) => {
            if (char.name !== characterName) return char;

            // Check if attribute already exists
            const existingAttr = char.attributes.find(
              (a) => a.category === category && a.name === value,
            );
            if (existingAttr) return char;

            // Add new attribute with empty evidence (manually added)
            const newAttribute: CharacterAttribute = {
              category: category as any,
              name: value,
              evidence: [],
            };

            return {
              ...char,
              attributes: [...char.attributes, newAttribute],
            };
          }),
        })),

      removeAttributeFromCharacter: (
        characterName: string,
        category: string,
        value: string,
      ) =>
        set((state) => ({
          characters: state.characters.map((char) => {
            if (char.name !== characterName) return char;

            return {
              ...char,
              attributes: char.attributes.filter(
                (a) => !(a.category === category && a.name === value),
              ),
            };
          }),
        })),
    }),
    {
      name: "character-storage",
      version: 2,
      migrate: (persistedState: any, version: number) => {
        // Migration for old data without source field
        if (version < 2) {
          return {
            ...persistedState,
            version: 2,
            characters: (persistedState.characters || []).map((char: any) => ({
              ...char,
              source: char.source || "ai-extracted", // Assume old characters were AI extracted
            })),
          };
        }
        return persistedState;
      },
    },
  ),
);
