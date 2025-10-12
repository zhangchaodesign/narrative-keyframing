/**
 * Types for character indicators based on Rimmon-Kenan's characterization theory
 */

export type IndicatorType =
  | "directDefinition"
  | "actions"
  | "speech"
  | "appearance"
  | "environment";

/**
 * Indicator match with absolute position in story (stored in characterStore)
 */
export type IndicatorMatch = {
  sentenceIndex: number;
  startIndex: number; // Absolute position in story
  endIndex: number; // Absolute position in story
  text: string; // The actual indicator text
  type: IndicatorType;
};

/**
 * Indicator reference within a sentence (using relative indices, stored in sentenceCacheStore)
 */
export type SentenceIndicatorRef = {
  text: string; // The indicator text
  relativeIndex: number; // Position within the sentence (not absolute story position)
};

/**
 * All indicator types for a character within a sentence
 */
export type SentenceCharacterIndicators = {
  directDefinition: SentenceIndicatorRef[];
  actions: SentenceIndicatorRef[];
  speech: SentenceIndicatorRef[];
  appearance: SentenceIndicatorRef[];
  environment: SentenceIndicatorRef[];
};

/**
 * Character indicators grouped by type (stored in characterStore)
 */
export type CharacterIndicators = {
  directDefinition: IndicatorMatch[];
  actions: IndicatorMatch[];
  speech: IndicatorMatch[];
  appearance: IndicatorMatch[];
  environment: IndicatorMatch[];
};
