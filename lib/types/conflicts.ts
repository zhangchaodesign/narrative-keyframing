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
 * A conflict between two attributes
 */
export type AttributeConflict = {
  id: string; // Unique identifier for this conflict
  category: AttributeCategory;
  attribute1: {
    name: string;
    evidence: AttributeEvidence;
  };
  attribute2: {
    name: string;
    evidence: AttributeEvidence;
  };
  severity: ConflictSeverity;
  explanation: string; // Why these conflict
  detectedAt: number; // Timestamp when conflict was detected
};

/**
 * Conflict data stored per character
 */
export type CharacterConflicts = {
  conflicts: AttributeConflict[];
};
