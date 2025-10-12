/**
 * Types for character attributes based on Egri's "bone structure"
 * Three categories: Physiology, Psychology, Sociology
 */

import { IndicatorType } from "./indicators";

export type AttributeCategory = "physiology" | "psychology" | "sociology";

/**
 * Evidence for an attribute with relative position (stored in sentenceCacheStore)
 */
export type AttributeEvidenceRef = {
  text: string; // Verbatim text from sentence
  indicatorType: IndicatorType; // Which indicator type this evidence represents
  relativeIndex: number; // Position within the sentence
};

/**
 * Evidence for an attribute with absolute position (stored in characterStore)
 */
export type AttributeEvidence = {
  text: string; // Verbatim text from sentence
  indicatorType: IndicatorType; // Which indicator type this evidence represents
  startIndex: number; // Absolute position in story
  endIndex: number; // Absolute position in story
  sentenceIndex: number; // Which sentence this evidence is from
};

/**
 * A character attribute inferred from the text
 */
export type CharacterAttribute = {
  category: AttributeCategory;
  name: string; // e.g., "nervous", "intelligent", "wealthy"
  evidence: AttributeEvidence[];
};

/**
 * Sentence-level attribute cache with relative indices
 */
export type SentenceAttribute = {
  category: AttributeCategory;
  name: string;
  evidence: AttributeEvidenceRef[];
};

/**
 * All attributes for a character within a sentence (cached)
 */
export type SentenceCharacterAttributes = {
  physiology: SentenceAttribute[];
  psychology: SentenceAttribute[];
  sociology: SentenceAttribute[];
};
