/**
 * Types for character attribute conflict detection
 * Identifies inconsistencies in characterization across the story
 */

import type { AttributeCategory, AttributeEvidence } from "./attributes";

/**
 * Severity level of a conflict
 */
export type ConflictSeverity = "high" | "medium" | "low";

/**
 * A conflict between an established attribute and contradictory evidence from a sentence
 */
export type AttributeConflict = {
  id: string; // Unique identifier for this conflict
  category: AttributeCategory;

  // The established attribute being contradicted
  establishedAttribute: {
    name: string;
    evidence: AttributeEvidence; // Original evidence that established this attribute
  };

  // The contradictory evidence from a new sentence
  conflictingEvidence: {
    text: string; // The conflicting text from the sentence
    sentenceIndex: number; // Which sentence contains the conflict
    startIndex: number; // Absolute position in story
    endIndex: number; // Absolute position in story
  };

  severity: ConflictSeverity;
  explanation: string; // Why the sentence conflicts with the attribute
  detectedAt: number; // Timestamp when conflict was detected
};

/**
 * Conflict data stored per character
 */
export type CharacterConflicts = {
  conflicts: AttributeConflict[];
};
