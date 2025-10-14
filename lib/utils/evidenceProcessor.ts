/**
 * Evidence-First Processing Architecture
 *
 * New three-phase approach:
 * Phase 1: Extract indicator phrases
 * Phase 2: Classify phrases (matching/conflicting/irrelevant)
 * Phase 3: Infer attributes for irrelevant phrases
 */

import { TextUtils } from "./textUtils";
import type { Character } from "../stores/characterStore";
import type { SentenceCache } from "../stores/sentenceCacheStore";
import type {
  ExtractedPhrase,
  ClassificationResult,
  AttributeInference,
  ProcessedEvidence,
} from "../types/evidence";
import type {
  IndicatorType,
  SentenceCharacterIndicators,
} from "../types/indicators";
import type {
  AttributeCategory,
  SentenceCharacterAttributes,
  SentenceAttribute,
  AttributeEvidenceRef,
} from "../types/attributes";

const INDICATOR_TYPES: IndicatorType[] = [
  "directDefinition",
  "actions",
  "speech",
  "appearance",
  "environment",
];

const ATTRIBUTE_CATEGORIES: AttributeCategory[] = [
  "physiology",
  "psychology",
  "sociology",
];

export class EvidenceProcessor {
  /**
   * Phase 1: Extract all indicator phrases from a sentence
   */
  private static async extractPhrasesForIndicator(
    story: string,
    sentence: string,
    characterName: string,
    indicatorType: IndicatorType,
  ): Promise<ExtractedPhrase[]> {
    try {
      const response = await fetch("/api/evidence/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          sentence,
          characterName,
          indicatorType,
        }),
      });

      if (!response.ok) {
        console.error(
          `Failed to extract ${indicatorType} phrases for ${characterName}`,
        );
        return [];
      }

      const data = await response.json();
      return (data.phrases || []).map((p: any) => ({
        text: p.text,
        indicatorType,
        startOffset: p.startOffset,
        characterName,
      }));
    } catch (error) {
      console.error(
        `Error extracting ${indicatorType} phrases for ${characterName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Phase 2: Classify a phrase against existing attributes
   */
  private static async classifyPhrase(
    story: string,
    sentence: string,
    characterName: string,
    phrase: ExtractedPhrase,
    existingAttributes: any[],
  ): Promise<ClassificationResult> {
    try {
      const response = await fetch("/api/evidence/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          sentence,
          characterName,
          phrase: phrase.text,
          existingAttributes,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to classify phrase for ${characterName}`);
        return { result: "irrelevant" };
      }

      return await response.json();
    } catch (error) {
      console.error(`Error classifying phrase for ${characterName}:`, error);
      return { result: "irrelevant" };
    }
  }

  /**
   * Phase 3: Infer attribute from an irrelevant phrase
   */
  private static async inferAttributeForPhrase(
    story: string,
    sentence: string,
    characterName: string,
    phrase: ExtractedPhrase,
    category: AttributeCategory,
  ): Promise<AttributeInference> {
    try {
      const response = await fetch("/api/evidence/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          sentence,
          characterName,
          phrase: phrase.text,
          category,
        }),
      });

      if (!response.ok) {
        console.error(
          `Failed to infer ${category} attribute for ${characterName}`,
        );
        return { hasAttribute: false, category };
      }

      const data = await response.json();
      return { ...data, category };
    } catch (error) {
      console.error(
        `Error inferring ${category} attribute for ${characterName}:`,
        error,
      );
      return { hasAttribute: false, category };
    }
  }

  /**
   * Process a single sentence using evidence-first approach
   */
  static async processSentenceEvidenceFirst(
    story: string,
    sentence: { text: string; startIndex: number },
    sentenceIndex: number,
    characterNames: string[],
    existingCharacters: Character[],
  ): Promise<SentenceCache> {
    const characterRefs: any = {};
    const characterIndicators: {
      [characterName: string]: SentenceCharacterIndicators;
    } = {};
    const characterAttributes: {
      [characterName: string]: SentenceCharacterAttributes;
    } = {};

    // Process all characters in parallel
    await Promise.all(
      characterNames.map(async (characterName) => {
        try {
          // First, still extract coreferences (unchanged)
          const corefResponse = await fetch("/api/coreference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              story,
              characterName,
              sentence: sentence.text,
            }),
          });

          if (!corefResponse.ok) {
            // Initialize empty data
            characterRefs[characterName] = [];
            characterIndicators[characterName] = {
              directDefinition: [],
              actions: [],
              speech: [],
              appearance: [],
              environment: [],
            };
            characterAttributes[characterName] = {
              physiology: [],
              psychology: [],
              sociology: [],
            };
            return;
          }

          const corefData = await corefResponse.json();
          const coreferences: string[] = corefData.coreferences || [];

          // Convert coreferences to relative indices
          const refs: any[] = [];
          for (const corefText of coreferences) {
            const indices = TextUtils.findAllWordMatches(
              sentence.text,
              corefText,
            );
            for (const relativeIndex of indices) {
              refs.push({ text: corefText, relativeIndex });
            }
          }
          characterRefs[characterName] = refs;

          // If no coreferences, skip attribute extraction
          if (coreferences.length === 0) {
            characterIndicators[characterName] = {
              directDefinition: [],
              actions: [],
              speech: [],
              appearance: [],
              environment: [],
            };
            characterAttributes[characterName] = {
              physiology: [],
              psychology: [],
              sociology: [],
            };
            return;
          }

          // === NEW EVIDENCE-FIRST PROCESSING ===

          // Phase 1: Extract all phrases (5 parallel calls)
          const phraseExtractions = await Promise.all(
            INDICATOR_TYPES.map((type) =>
              this.extractPhrasesForIndicator(
                story,
                sentence.text,
                characterName,
                type,
              ),
            ),
          );

          const allPhrases: ExtractedPhrase[] = phraseExtractions.flat();

          console.log(
            `Extracted ${allPhrases.length} phrases for ${characterName} in sentence ${sentenceIndex}`,
          );

          if (allPhrases.length === 0) {
            // No phrases found
            characterIndicators[characterName] = {
              directDefinition: [],
              actions: [],
              speech: [],
              appearance: [],
              environment: [],
            };
            characterAttributes[characterName] = {
              physiology: [],
              psychology: [],
              sociology: [],
            };
            return;
          }

          // Get existing attributes for this character
          const existingChar = existingCharacters.find(
            (c) => c.name === characterName,
          );
          const existingAttributes = existingChar?.attributes || [];

          // Phase 2: Classify all phrases (parallel)
          const classifications = await Promise.all(
            allPhrases.map((phrase) =>
              this.classifyPhrase(
                story,
                sentence.text,
                characterName,
                phrase,
                existingAttributes,
              ),
            ),
          );

          // Phase 3: Process classifications and infer for irrelevant phrases
          const processedEvidences: ProcessedEvidence[] = await Promise.all(
            allPhrases.map(async (phrase, idx) => {
              const classification = classifications[idx];

              if (classification.result === "irrelevant") {
                // Infer attributes (3 parallel calls)
                const inferences = await Promise.all(
                  ATTRIBUTE_CATEGORIES.map((category) =>
                    this.inferAttributeForPhrase(
                      story,
                      sentence.text,
                      characterName,
                      phrase,
                      category,
                    ),
                  ),
                );

                return {
                  phrase,
                  classification,
                  inferences: inferences.filter((inf) => inf.hasAttribute),
                };
              }

              return {
                phrase,
                classification,
              };
            }),
          );

          // Convert processed evidences to old data structure for compatibility
          const indicators: SentenceCharacterIndicators = {
            directDefinition: [],
            actions: [],
            speech: [],
            appearance: [],
            environment: [],
          };

          const attributes: SentenceCharacterAttributes = {
            physiology: [],
            psychology: [],
            sociology: [],
          };

          // Build attributes from processed evidences
          for (const evidence of processedEvidences) {
            const { phrase, classification, inferences } = evidence;

            if (classification.result === "matching") {
              // Link to existing attribute
              const [category, attrName] = (
                classification.matchedAttributeId || ""
              ).split("-");
              if (category && attrName) {
                const attrCategory = category as AttributeCategory;
                const existingAttr = attributes[attrCategory].find(
                  (a) => a.name === attrName,
                );

                const evidenceRef: AttributeEvidenceRef = {
                  text: phrase.text,
                  indicatorType: phrase.indicatorType,
                  relativeIndex: phrase.startOffset,
                };

                if (existingAttr) {
                  existingAttr.evidence.push(evidenceRef);
                } else {
                  attributes[attrCategory].push({
                    category: attrCategory,
                    name: attrName,
                    evidence: [evidenceRef],
                  });
                }
              }
            } else if (classification.result === "irrelevant" && inferences) {
              // Create new attributes from inferences
              for (const inference of inferences) {
                if (inference.hasAttribute && inference.attributeName) {
                  const existingAttr = attributes[inference.category].find(
                    (a) => a.name === inference.attributeName,
                  );

                  const evidenceRef: AttributeEvidenceRef = {
                    text: phrase.text,
                    indicatorType: phrase.indicatorType,
                    relativeIndex: phrase.startOffset,
                  };

                  if (existingAttr) {
                    existingAttr.evidence.push(evidenceRef);
                  } else {
                    attributes[inference.category].push({
                      category: inference.category,
                      name: inference.attributeName,
                      evidence: [evidenceRef],
                    });
                  }
                }
              }
            }
            // For conflicting, we'll handle separately in conflict detection
          }

          characterIndicators[characterName] = indicators;
          characterAttributes[characterName] = attributes;
        } catch (error) {
          console.error(
            `Error processing sentence ${sentenceIndex} for character ${characterName}:`,
            error,
          );
          characterRefs[characterName] = [];
          characterIndicators[characterName] = {
            directDefinition: [],
            actions: [],
            speech: [],
            appearance: [],
            environment: [],
          };
          characterAttributes[characterName] = {
            physiology: [],
            psychology: [],
            sociology: [],
          };
        }
      }),
    );

    return {
      text: sentence.text,
      characterRefs,
      characterIndicators,
      characterAttributes,
    };
  }
}
