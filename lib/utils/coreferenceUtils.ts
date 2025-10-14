import { TextUtils } from "./textUtils";
import { EvidenceProcessor } from "./evidenceProcessor";
import type { Character, CoreferenceMatch } from "../stores/characterStore";
import type {
  SentenceCache,
  SentenceCharacterRef,
} from "../stores/sentenceCacheStore";
import type {
  IndicatorType,
  SentenceIndicatorRef,
  SentenceCharacterIndicators,
  CharacterIndicators,
  IndicatorMatch,
} from "../types/indicators";
import type {
  AttributeCategory,
  AttributeEvidenceRef,
  SentenceAttribute,
  SentenceCharacterAttributes,
  CharacterAttribute,
  AttributeEvidence,
} from "../types/attributes";
import type { AttributeConflict, ConflictSeverity } from "../types/conflicts";

// Feature flag: Enable new evidence-first architecture
const USE_EVIDENCE_FIRST = true;

export class CoreferenceUtils {
  /**
   * Compare current sentences with cached sentences and identify changes
   * Uses content-based matching to properly detect insertions/deletions
   * @param currentSentences - Current story sentences
   * @param cachedSentences - Previously cached sentence data
   * @returns Map from current index to cache index (or null if new), plus list of new indices
   */
  private static detectSentenceChanges(
    currentSentences: Array<{ text: string; startIndex: number }>,
    cachedSentences: SentenceCache[],
  ): {
    cacheMapping: Map<number, number | null>; // current index → cache index (null = new)
    newIndices: number[]; // Indices of new sentences
  } {
    // Build a map of cached sentence text to their indices
    const cacheTextMap = new Map<string, number[]>();
    cachedSentences.forEach((cache, index) => {
      const existing = cacheTextMap.get(cache.text) || [];
      existing.push(index);
      cacheTextMap.set(cache.text, existing);
    });

    const cacheMapping = new Map<number, number | null>();
    const newIndices: number[] = [];
    const usedCacheIndices = new Set<number>();

    // Match current sentences to cached sentences by content
    for (let i = 0; i < currentSentences.length; i++) {
      const currentText = currentSentences[i].text;
      const cacheIndices = cacheTextMap.get(currentText) || [];

      // Find first unused cache index with matching text
      let matchedCacheIndex: number | null = null;
      for (const cacheIdx of cacheIndices) {
        if (!usedCacheIndices.has(cacheIdx)) {
          matchedCacheIndex = cacheIdx;
          usedCacheIndices.add(cacheIdx);
          break;
        }
      }

      if (matchedCacheIndex !== null) {
        // Found matching cached sentence - reuse it
        cacheMapping.set(i, matchedCacheIndex);
      } else {
        // No matching cached sentence - it's new
        cacheMapping.set(i, null);
        newIndices.push(i);
      }
    }

    return { cacheMapping, newIndices };
  }

  /**
   * Convert cached sentence data to absolute character matches
   * @param sentenceCache - Cached sentence data with relative indices
   * @param sentenceIndex - Index of this sentence in the story
   * @param sentenceStartIndex - Absolute start position of this sentence in story
   * @returns Array of CoreferenceMatch objects with absolute indices
   */
  private static sentenceCacheToMatches(
    sentenceCache: SentenceCache,
    sentenceIndex: number,
    sentenceStartIndex: number,
  ): Map<string, CoreferenceMatch[]> {
    const matchesByCharacter = new Map<string, CoreferenceMatch[]>();

    for (const [characterName, refs] of Object.entries(
      sentenceCache.characterRefs,
    )) {
      const matches: CoreferenceMatch[] = refs.map((ref) => ({
        sentenceIndex,
        startIndex: sentenceStartIndex + ref.relativeIndex,
        endIndex: sentenceStartIndex + ref.relativeIndex + ref.text.length,
        text: ref.text,
      }));

      matchesByCharacter.set(characterName, matches);
    }

    return matchesByCharacter;
  }

  /**
   * Convert cached attribute data to absolute attribute matches
   * @param sentenceCache - Cached sentence data with relative indices
   * @param sentenceIndex - Index of this sentence in the story
   * @param sentenceStartIndex - Absolute start position of this sentence in story
   * @returns Map of character name to their attributes
   */
  /**
   * Normalize attribute name for fuzzy matching
   * Handles: singular/plural, articles (a/an/the), extra spaces
   * Examples:
   *   "social connections" → "social connection"
   *   "love cats" → "love cat"
   *   "a nervous person" → "nervous person"
   */
  private static normalizeAttributeName(name: string): string {
    let normalized = name.toLowerCase().trim();

    // Remove articles (a, an, the) at the beginning
    normalized = normalized.replace(/^(a|an|the)\s+/i, "");

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, " ");

    // Simple plural to singular conversion
    // Handle common patterns: -ies → -y, -es → e or nothing, -s → nothing
    normalized = normalized
      .replace(/ies\b/g, "y") // cities → city, worries → worry
      .replace(/sses\b/g, "ss") // classes → class, passes → pass
      .replace(/([^aeiou])es\b/g, "$1e") //aches → ache, boxes → boxe (imperfect but reasonable)
      .replace(/([aeiou])s\b/g, "$1") // cats → cat, dogs → dog
      .replace(/([^s])s\b/g, "$1"); // connections → connection, but not grass → gras

    return normalized;
  }

  /**
   * Consolidate duplicate attributes by grouping same category+name and merging evidence
   * Example: Two "calm" psychology attributes become one with combined evidence
   * Uses fuzzy matching to handle variations: "social connections" = "social connection"
   */
  private static consolidateAttributes(
    attributes: CharacterAttribute[],
  ): CharacterAttribute[] {
    const attributeMap = new Map<string, CharacterAttribute>();

    for (const attr of attributes) {
      // Normalize name for fuzzy matching
      const normalizedName = this.normalizeAttributeName(attr.name);
      const key = `${attr.category}:${normalizedName}`;

      if (attributeMap.has(key)) {
        // Merge evidence into existing attribute
        const existing = attributeMap.get(key)!;
        existing.evidence = [...existing.evidence, ...attr.evidence];
      } else {
        // First occurrence - create new entry with evidence copy
        // Use original name (not normalized) for display
        attributeMap.set(key, {
          category: attr.category,
          name: attr.name,
          evidence: [...attr.evidence],
        });
      }
    }

    return Array.from(attributeMap.values());
  }

  private static sentenceCacheToAttributes(
    sentenceCache: SentenceCache,
    sentenceIndex: number,
    sentenceStartIndex: number,
  ): Map<string, CharacterAttribute[]> {
    const attributesByCharacter = new Map<string, CharacterAttribute[]>();

    for (const [characterName, sentenceAttrs] of Object.entries(
      sentenceCache.characterAttributes || {},
    )) {
      const allAttributes: CharacterAttribute[] = [];

      // Process each category
      const categories: AttributeCategory[] = [
        "physiology",
        "psychology",
        "sociology",
      ];

      for (const category of categories) {
        const categoryAttrs = sentenceAttrs[category] || [];

        for (const attr of categoryAttrs) {
          // Convert evidence to absolute indices
          const evidence: AttributeEvidence[] = attr.evidence.map((ev) => ({
            text: ev.text,
            indicatorType: ev.indicatorType,
            startIndex: sentenceStartIndex + ev.relativeIndex,
            endIndex: sentenceStartIndex + ev.relativeIndex + ev.text.length,
            sentenceIndex,
          }));

          allAttributes.push({
            category: attr.category,
            name: attr.name,
            evidence,
          });
        }
      }

      attributesByCharacter.set(characterName, allAttributes);
    }

    return attributesByCharacter;
  }

  /**
   * Extract attributes for a character in a sentence using Egri's bone structure
   * @param story - Full story text (for context)
   * @param characterName - Character to analyze
   * @param sentence - Sentence text
   * @param coreferences - List of coreferences found for this character
   * @returns SentenceCharacterAttributes object
   */
  private static async extractAttributesForCharacter(
    story: string,
    characterName: string,
    sentence: string,
    coreferences: string[],
  ): Promise<SentenceCharacterAttributes> {
    const attributes: SentenceCharacterAttributes = {
      physiology: [],
      psychology: [],
      sociology: [],
    };

    // Only process if there are coreferences in this sentence
    if (coreferences.length === 0) {
      return attributes;
    }

    // Call all 3 attribute category APIs in parallel
    const categories: AttributeCategory[] = [
      "physiology",
      "psychology",
      "sociology",
    ];

    await Promise.all(
      categories.map(async (category) => {
        try {
          const response = await fetch(`/api/attributes/${category}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              story,
              characterName,
              sentence,
              coreferences,
            }),
          });

          if (!response.ok) {
            console.error(
              `Failed to extract ${category} attributes for ${characterName}`,
            );
            return;
          }

          const data = await response.json();
          const attributesData: Array<{
            name: string;
            evidence: Array<{ text: string; indicatorType: string }>;
          }> = data.attributes || [];

          // Convert to SentenceAttribute with relative indices
          const sentenceAttributes: SentenceAttribute[] = [];

          for (const attr of attributesData) {
            // console.log("Processing attribute:", attr, category);

            const evidenceRefs: AttributeEvidenceRef[] = [];

            for (const ev of attr.evidence) {
              // Find all occurrences of this evidence text in the sentence
              const indices = TextUtils.findAllWordMatches(sentence, ev.text);
              console.log(`Found indices for evidence "${ev.text}":`, indices);
              for (const relativeIndex of indices) {
                evidenceRefs.push({
                  text: ev.text,
                  indicatorType: ev.indicatorType as IndicatorType,
                  relativeIndex,
                });
              }
            }

            if (evidenceRefs.length > 0) {
              sentenceAttributes.push({
                category,
                name: attr.name,
                evidence: evidenceRefs,
              });
            }
          }

          attributes[category] = sentenceAttributes;
        } catch (error) {
          console.error(
            `Error extracting ${category} attributes for ${characterName}:`,
            error,
          );
        }
      }),
    );

    return attributes;
  }

  /**
   * Detect conflicts between a sentence and existing character attributes
   * Checks if the sentence content contradicts established attributes
   * @param characterName - Character being analyzed
   * @param sentence - Sentence text
   * @param sentenceIndex - Index of sentence in story
   * @param sentenceStartIndex - Absolute start position in story
   * @param existingAttributes - All previously accumulated attributes for character
   * @returns Array of detected conflicts
   */
  private static async detectSentenceConflicts(
    characterName: string,
    sentence: string,
    sentenceIndex: number,
    sentenceStartIndex: number,
    existingAttributes: CharacterAttribute[],
  ): Promise<AttributeConflict[]> {
    const conflicts: AttributeConflict[] = [];

    if (existingAttributes.length === 0) {
      // No existing attributes to conflict with
      return conflicts;
    }

    // Build summary of existing attributes for API call
    const existingSummary = existingAttributes.map((attr) => ({
      name: attr.name,
      category: attr.category,
      evidenceCount: attr.evidence.length,
    }));

    try {
      const response = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName,
          sentence,
          existingAttributes: existingSummary,
        }),
      });

      if (!response.ok) {
        console.error("Failed to detect sentence conflicts");
        return conflicts;
      }

      const data = await response.json();

      // Process each detected conflict
      for (const conflictData of data.conflicts || []) {
        // Find the established attribute being contradicted
        const establishedAttr = existingAttributes.find(
          (attr) =>
            attr.name === conflictData.attributeName &&
            attr.category === conflictData.attributeCategory,
        );

        if (establishedAttr && establishedAttr.evidence.length > 0) {
          // Find position of conflicting evidence in sentence
          const conflictingText = conflictData.conflictingEvidence;
          const relativeIndex = sentence.indexOf(conflictingText);

          if (relativeIndex === -1) {
            console.warn(
              `Conflicting evidence "${conflictingText}" not found in sentence`,
            );
            continue;
          }

          // Create conflict record
          const conflict: AttributeConflict = {
            id: `${
              conflictData.attributeCategory
            }-${Date.now()}-${Math.random()}`,
            category: conflictData.attributeCategory as AttributeCategory,
            establishedAttribute: {
              name: establishedAttr.name,
              evidence: establishedAttr.evidence[0], // Use first evidence of established attribute
            },
            conflictingEvidence: {
              text: conflictingText,
              sentenceIndex,
              startIndex: sentenceStartIndex + relativeIndex,
              endIndex:
                sentenceStartIndex + relativeIndex + conflictingText.length,
            },
            severity: conflictData.severity as ConflictSeverity,
            explanation: conflictData.explanation,
            detectedAt: Date.now(),
          };

          conflicts.push(conflict);
        }
      }
    } catch (error) {
      console.error("Error detecting sentence conflicts:", error);
    }

    return conflicts;
  }

  /**
   * Process a single sentence to extract character references and attributes
   * @param story - Full story text (for context)
   * @param sentence - Sentence to process
   * @param sentenceIndex - Index of this sentence
   * @param characterNames - Characters to look for
   * @returns SentenceCache object for this sentence
   */
  private static async processSentence(
    story: string,
    sentence: { text: string; startIndex: number },
    sentenceIndex: number,
    characterNames: string[],
  ): Promise<SentenceCache> {
    const characterRefs: { [characterName: string]: SentenceCharacterRef[] } =
      {};
    const characterIndicators: {
      [characterName: string]: SentenceCharacterIndicators;
    } = {};
    const characterAttributes: {
      [characterName: string]: SentenceCharacterAttributes;
    } = {};

    // Process all characters for this sentence in parallel
    await Promise.all(
      characterNames.map(async (characterName) => {
        try {
          // Step 1: Extract coreferences
          const response = await fetch("/api/coreference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              story,
              characterName,
              sentence: sentence.text,
            }),
          });

          if (!response.ok) {
            console.error(
              `Failed to extract coreferences for ${characterName} in sentence ${sentenceIndex}`,
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
            return;
          }

          const data = await response.json();
          const coreferences: string[] = data.coreferences || [];

          // Convert coreferences to relative indices
          const refs: SentenceCharacterRef[] = [];
          for (const corefText of coreferences) {
            const indices = TextUtils.findAllWordMatches(
              sentence.text,
              corefText,
            );
            for (const relativeIndex of indices) {
              refs.push({
                text: corefText,
                relativeIndex,
              });
            }
          }

          characterRefs[characterName] = refs;

          // Step 2: Extract attributes (using Egri's bone structure)
          const attributes = await this.extractAttributesForCharacter(
            story,
            characterName,
            sentence.text,
            coreferences,
          );
          characterAttributes[characterName] = attributes;

          // Step 3: Extract indicators (for character development tracking)
          // const indicators = await this.extractIndicatorsForCharacter(
          //   story,
          //   characterName,
          //   sentence.text,
          //   coreferences,
          // );
          const indicators: SentenceCharacterIndicators = {
            directDefinition: [],
            actions: [],
            speech: [],
            appearance: [],
            environment: [],
          }; // Skip for now to reduce API calls
          characterIndicators[characterName] = indicators;
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

  /**
   * Extract coreference mentions for all characters in a story (with smart caching)
   * @param story - The full story text
   * @param characterNames - Array of character names to track
   * @param existingCache - Optional existing sentence caches
   * @param cachedCharacterNames - Characters the cache was built for
   * @returns Object with character data and updated cache
   */
  static async extractAllCoreferencesWithCache(
    story: string,
    characterNames: string[],
    existingCache?: SentenceCache[],
    cachedCharacterNames?: string[],
    existingCharacters?: Character[],
  ): Promise<{
    characters: Character[];
    sentenceCaches: SentenceCache[];
  }> {
    const sentences = TextUtils.splitIntoSentences(story);
    const cache = existingCache || [];

    // Check if character list changed (order doesn't matter, just set membership)
    const characterListChanged = (() => {
      if (
        !cachedCharacterNames ||
        cachedCharacterNames.length !== characterNames.length
      ) {
        return true;
      }
      // Same length, check if same set of names
      const cachedSet = new Set(cachedCharacterNames);
      return !characterNames.every((name) => cachedSet.has(name));
    })();

    // Detect which sentences need processing using content-based matching
    const { cacheMapping, newIndices } = this.detectSentenceChanges(
      sentences,
      cache,
    );

    // Count how many sentences can be reused
    const reuseCount = Array.from(cacheMapping.values()).filter(
      (v) => v !== null,
    ).length;

    console.log(
      `Cache analysis: ${reuseCount} reused from cache, ${newIndices.length} new sentences (total sentences: ${sentences.length}, cached: ${cache.length})`,
    );

    // Debug: Show the mapping
    console.log(
      "Cache mapping:",
      Array.from(cacheMapping.entries())
        .map(
          ([curr, cached]) =>
            `current[${curr}]="${sentences[curr].text.substring(0, 30)}..." → ${
              cached !== null ? `cache[${cached}]` : "NEW"
            }`,
        )
        .join("\n"),
    );

    // Determine which sentences need API calls
    const sentencesToProcess = characterListChanged
      ? sentences.map((_, i) => i) // Process all if character list changed
      : newIndices; // Only process new sentences when incrementally updating

    console.log(
      `Processing ${sentencesToProcess.length} sentences (${
        characterListChanged ? "character list changed" : "incremental update"
      })`,
    );

    // Process sentences that need updating in parallel
    const processedCaches = await Promise.all(
      sentencesToProcess.map((sentIndex) =>
        USE_EVIDENCE_FIRST
          ? EvidenceProcessor.processSentenceEvidenceFirst(
              story,
              sentences[sentIndex],
              sentIndex,
              characterNames,
              existingCharacters || [],
            )
          : this.processSentence(
              story,
              sentences[sentIndex],
              sentIndex,
              characterNames,
            ),
      ),
    );

    // Build the final cache array
    const newCache: SentenceCache[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const cachedIndex = cacheMapping.get(i);

      if (sentencesToProcess.includes(i)) {
        // Use newly processed data
        const processedIndex = sentencesToProcess.indexOf(i);
        newCache[i] = processedCaches[processedIndex];
      } else if (cachedIndex !== null && cachedIndex !== undefined) {
        // Reuse existing cache from the matched sentence
        newCache[i] = cache[cachedIndex];
      } else {
        // Shouldn't happen, but create empty cache as fallback
        newCache[i] = {
          text: sentences[i].text,
          characterRefs: {},
          characterIndicators: {},
          characterAttributes: {},
        };
      }
    }

    // Convert cache to character matches with absolute indices
    const characterMatchMap = new Map<string, CoreferenceMatch[]>();
    const characterIndicatorMap = new Map<string, CharacterIndicators>();
    const characterAttributeMap = new Map<string, CharacterAttribute[]>();
    const characterConflictMap = new Map<string, AttributeConflict[]>();

    // Initialize all characters
    characterNames.forEach((name) => {
      characterMatchMap.set(name, []);
      characterIndicatorMap.set(name, {
        directDefinition: [],
        actions: [],
        speech: [],
        appearance: [],
        environment: [],
      });
      characterAttributeMap.set(name, []);
      characterConflictMap.set(name, []);
    });

    // Process each sentence's cache and convert to absolute indices
    for (let sentIndex = 0; sentIndex < sentences.length; sentIndex++) {
      const sentenceCache = newCache[sentIndex];

      // Convert coreferences
      const matches = this.sentenceCacheToMatches(
        sentenceCache,
        sentIndex,
        sentences[sentIndex].startIndex,
      );

      // Merge matches into character map
      matches.forEach((matchList, characterName) => {
        const existing = characterMatchMap.get(characterName) || [];
        characterMatchMap.set(characterName, [...existing, ...matchList]);
      });

      // Convert attributes (NEW)
      const attributes = this.sentenceCacheToAttributes(
        sentenceCache,
        sentIndex,
        sentences[sentIndex].startIndex,
      );

      console.log(
        `Sentence ${sentIndex} attributes:`,
        Array.from(attributes.entries()),
      );

      // Merge attributes into character map FIRST
      attributes.forEach((attributeList, characterName) => {
        const existing = characterAttributeMap.get(characterName) || [];
        characterAttributeMap.set(characterName, [
          ...existing,
          ...attributeList,
        ]);
      });

      // Detect conflicts for newly processed sentences only
      // Check if sentence content contradicts existing attributes (NEW approach)
      if (sentencesToProcess.includes(sentIndex)) {
        console.log(`Checking conflicts for sentence ${sentIndex}...`);

        // Process each character that has coreferences in this sentence
        for (const characterName of characterNames) {
          // Get all attributes accumulated BEFORE this sentence
          const allAttributes = characterAttributeMap.get(characterName) || [];
          console.log(
            `Existing attributes for ${characterName}:`,
            allAttributes,
          );
          const existingAttributes = allAttributes.filter((attr) =>
            attr.evidence.some((ev) => ev.sentenceIndex < sentIndex),
          );

          // ALSO include manually added attributes from existingCharacters (these have no evidence)
          const manualAttributes: CharacterAttribute[] = [];
          if (existingCharacters) {
            const existingChar = existingCharacters.find(
              (c) => c.name === characterName,
            );
            if (existingChar) {
              // Get manual attributes (no evidence or empty evidence)
              const manualAttrs = existingChar.attributes.filter(
                (attr) => !attr.evidence || attr.evidence.length === 0,
              );
              manualAttributes.push(...manualAttrs);
            }
          }

          // Combine AI-extracted attributes with manual attributes
          const allExistingAttributes = [
            ...existingAttributes,
            ...manualAttributes,
          ];

          if (allExistingAttributes.length === 0) {
            // First sentence with attributes, nothing to conflict with
            console.log(
              `No existing attributes for ${characterName} before sentence ${sentIndex}, skipping conflict check.`,
            );
            continue;
          }

          // Only check sentences that mention this character
          const sentenceCache = newCache[sentIndex];
          const characterRefs =
            sentenceCache.characterRefs[characterName] || [];

          if (characterRefs.length === 0) {
            // Character not mentioned in this sentence, skip
            console.log(
              `Character ${characterName} not mentioned in sentence ${sentIndex}, skipping conflict check.`,
            );
            continue;
          }

          try {
            // Check if this sentence contradicts any existing attributes (including manual ones)
            const detectedConflicts = await this.detectSentenceConflicts(
              characterName,
              sentences[sentIndex].text,
              sentIndex,
              sentences[sentIndex].startIndex,
              allExistingAttributes,
            );

            if (detectedConflicts.length > 0) {
              const existing = characterConflictMap.get(characterName) || [];
              characterConflictMap.set(characterName, [
                ...existing,
                ...detectedConflicts,
              ]);

              console.log(
                `Found ${detectedConflicts.length} conflicts for ${characterName} in sentence ${sentIndex}`,
              );
            } else {
              console.log(
                `No conflicts found for ${characterName} in sentence ${sentIndex}`,
              );
            }
          } catch (error) {
            console.error(
              `Error detecting conflicts for ${characterName} in sentence ${sentIndex}:`,
              error,
            );
          }
        }
      }
    }

    // Convert map to Character array and consolidate duplicate attributes
    const characters: Character[] = characterNames.map((name) => ({
      name,
      source: "ai-extracted" as const,
      coreferenceMatches: characterMatchMap.get(name) || [],
      indicatorMatches: characterIndicatorMap.get(name) || {
        directDefinition: [],
        actions: [],
        speech: [],
        appearance: [],
        environment: [],
      },
      attributes: this.consolidateAttributes(
        characterAttributeMap.get(name) || [],
      ),
      conflicts: characterConflictMap.get(name) || [],
    }));

    return {
      characters,
      sentenceCaches: newCache,
    };
  }

  /**
   * Extract coreference mentions for all characters (legacy method without caching)
   * Use extractAllCoreferencesWithCache for better performance
   */
  static async extractAllCoreferences(
    story: string,
    characterNames: string[],
  ): Promise<Character[]> {
    const result = await this.extractAllCoreferencesWithCache(
      story,
      characterNames,
    );
    return result.characters;
  }

  /**
   * Extract coreference mentions for a single character
   * @param story - The full story text
   * @param characterName - The character name to track
   * @returns Character object with coreference matches
   */
  static async extractCharacterCoreferences(
    story: string,
    characterName: string,
  ): Promise<Character> {
    const [character] = await this.extractAllCoreferences(story, [
      characterName,
    ]);
    return character;
  }
}
