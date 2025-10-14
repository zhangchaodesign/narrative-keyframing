/**
 * Evidence-First Processing Architecture
 *
 * New three-phase approach:
 * Phase 1: Extract indicator phrases
 * Phase 2: Classify phrases (relevant/irrelevant)
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

      // console.log("existingAttributes:", existingAttributes);

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

  private static addEvidenceIfNewByText(
    existingAttr: SentenceAttribute,
    newRef: AttributeEvidenceRef,
  ): void {
    const a = TextUtils.prepareStringForMatching(newRef.text) ?? "";
    if (!a) return;

    const isDup = existingAttr.evidence.some((e) => {
      const b = TextUtils.prepareStringForMatching(e.text) ?? "";
      if (!b) return false;

      // Fallback using word-boundary matcher
      console.log(`Checking evidence duplication: "${a}" vs "${b}"`);
      const ab = TextUtils.findAllWordMatches(b, a);
      const ba = TextUtils.findAllWordMatches(a, b);
      // if ab or ba has ANY matches, consider it a dup
      return ab.length > 0 || ba.length > 0;
    });

    if (!isDup) existingAttr.evidence.push(newRef);
  }

  /**
   * Process a single sentence using evidence-first approach
   * Now staged so that ALL /api/coreference calls finish before any other API calls run.
   */
  static async processSentenceEvidenceFirst(
    story: string,
    sentence: { text: string; startIndex: number },
    sentenceIndex: number,
    characterNames: string[],
    existingCharacters: Character[],
  ): Promise<SentenceCache> {
    const characterRefs: Record<string, any[]> = {};
    const characterIndicators: Record<string, SentenceCharacterIndicators> = {};
    const characterAttributes: Record<string, SentenceCharacterAttributes> = {};

    const emptyIndicators = (): SentenceCharacterIndicators => ({
      directDefinition: [],
      actions: [],
      speech: [],
      appearance: [],
      environment: [],
    });

    const emptyAttributes = (): SentenceCharacterAttributes => ({
      physiology: [],
      psychology: [],
      sociology: [],
    });

    // ---------------------------
    // Phase 1: coreference for ALL characters (in parallel)
    // ---------------------------
    type CorefResult = {
      characterName: string;
      ok: boolean;
      coreferences: string[];
      error?: unknown;
    };

    const corefResults: CorefResult[] = await Promise.all(
      characterNames.map(async (characterName): Promise<CorefResult> => {
        try {
          const res = await fetch("/api/coreference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              story,
              characterName,
              sentence: sentence.text,
            }),
          });

          if (!res.ok) {
            return { characterName, ok: false, coreferences: [] };
          }

          const data = await res.json();
          return {
            characterName,
            ok: true,
            coreferences: (data.coreferences as string[]) || [],
          };
        } catch (error) {
          console.error(
            `Coreference error in sentence ${sentenceIndex} for ${characterName}:`,
            error,
          );
          return { characterName, ok: false, coreferences: [], error };
        }
      }),
    );

    // Populate refs + defaults, and figure out which characters continue to Phase 2
    const charactersToProcessFurther: string[] = [];

    for (const { characterName, ok, coreferences } of corefResults) {
      // Convert coreferences to relative indices (same logic you had)
      const refs: any[] = [];
      if (ok && coreferences.length > 0) {
        for (const corefText of coreferences) {
          const indices = TextUtils.findAllWordMatches(
            sentence.text,
            corefText,
          );
          for (const relativeIndex of indices) {
            refs.push({ text: corefText, relativeIndex });
          }
        }
      }
      characterRefs[characterName] = refs;

      if (ok && coreferences.length > 0) {
        // Only these move to Phase 2
        charactersToProcessFurther.push(characterName);
      } else {
        // If coref failed or has no refs, set empty indicator/attributes now
        characterIndicators[characterName] = emptyIndicators();
        characterAttributes[characterName] = emptyAttributes();
      }
    }

    // ---------------------------
    // Phase 2: ONLY after all corefs are ready, run other API calls
    //          Process remaining characters in parallel
    // ---------------------------
    await Promise.all(
      charactersToProcessFurther.map(async (characterName) => {
        try {
          // === NEW EVIDENCE-FIRST PROCESSING ===

          // Phase 2.1: Extract phrases (5 parallel calls)
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
            characterIndicators[characterName] = emptyIndicators();
            characterAttributes[characterName] = emptyAttributes();
            return;
          }

          // Get existing attributes for this character
          const existingChar = existingCharacters.find(
            (c) => c.name === characterName,
          );
          const existingAttributes = existingChar?.attributes || [];

          // Phase 2.2: Classify all phrases (parallel)
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

          // Phase 2.3: Process classifications and infer for irrelevant phrases
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

              return { phrase, classification };
            }),
          );

          // Convert processed evidences to old data structure for compatibility
          const indicators: SentenceCharacterIndicators = emptyIndicators();
          const attributes: SentenceCharacterAttributes = emptyAttributes();

          // Build indicators and attributes from processed evidences
          for (const evidence of processedEvidences) {
            const { phrase, classification, inferences } = evidence;

            // Calculate all positions for this phrase in the sentence
            const phrasePositions = TextUtils.findAllWordMatches(
              sentence.text,
              phrase.text,
            );

            // If phrase not found, skip it (LLM hallucination)
            if (phrasePositions.length === 0) {
              console.warn(
                `Phrase "${phrase.text}" not found in sentence: "${sentence.text}"`,
              );
              continue;
            }

            // Add phrase to indicators for each occurrence
            for (const relativeIndex of phrasePositions) {
              indicators[phrase.indicatorType].push({
                text: phrase.text,
                relativeIndex,
              });
            }

            // Create attribute evidence refs for each occurrence
            for (const relativeIndex of phrasePositions) {
              if (classification.result === "relevant") {
                // Link to existing attribute
                const [category, attrName] = (
                  classification.matchedAttributeId || ""
                ).split("#");
                if (category && attrName) {
                  const attrCategory = category as AttributeCategory;
                  const existingAttr = attributes[attrCategory].find(
                    (a) => a.name === attrName,
                  );

                  const evidenceRef: AttributeEvidenceRef = {
                    text: phrase.text,
                    indicatorType: phrase.indicatorType,
                    relativeIndex,
                  };

                  if (existingAttr) {
                    this.addEvidenceIfNewByText(existingAttr, evidenceRef);
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
                      relativeIndex,
                    };

                    if (existingAttr) {
                      this.addEvidenceIfNewByText(existingAttr, evidenceRef);
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
              // Conflicts handled elsewhere
            }
          }

          characterIndicators[characterName] = indicators;
          characterAttributes[characterName] = attributes;
        } catch (error) {
          console.error(
            `Error processing sentence ${sentenceIndex} for character ${characterName}:`,
            error,
          );
          characterIndicators[characterName] = emptyIndicators();
          characterAttributes[characterName] = emptyAttributes();
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
