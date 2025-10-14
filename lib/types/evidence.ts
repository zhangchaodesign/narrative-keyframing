/**
 * Types for the new evidence-first architecture
 */

import { IndicatorType } from "./indicators";
import { AttributeCategory } from "./attributes";

/**
 * Extracted phrase from Phase 1 (evidence extraction)
 * Note: startOffset is calculated in JavaScript, not by LLM
 */
export type ExtractedPhrase = {
  text: string;
  indicatorType: IndicatorType;
  characterName: string;
};

/**
 * Classification result from Phase 2
 */
export type ClassificationResult = {
  result: "relevant" | "irrelevant";
  matchedAttributeId?: string; // Format: "category-name"
  conflictAttributeId?: string;
  conflictReason?: string;
  conflictSeverity?: "low" | "medium" | "high";
};

/**
 * Attribute inference result from Phase 3
 */
export type AttributeInference = {
  hasAttribute: boolean;
  attributeName?: string;
  confidence?: number;
  category: AttributeCategory;
};

/**
 * Complete evidence phrase with all processing results
 */
export type ProcessedEvidence = {
  // Original extraction
  phrase: ExtractedPhrase;
  // Classification
  classification: ClassificationResult;
  // Inferences (only if classification was "irrelevant")
  inferences?: AttributeInference[];
};

/**
 * Sentence cache with evidence-first approach
 */
export type EvidenceSentenceCache = {
  text: string;
  characterEvidence: {
    [characterName: string]: ProcessedEvidence[];
  };
};
