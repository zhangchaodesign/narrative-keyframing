import { TextUtils } from "./textUtils";
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
   * Consolidate duplicate attributes by grouping same category+name and merging evidence
   * Example: Two "calm" psychology attributes become one with combined evidence
   */
  private static consolidateAttributes(
    attributes: CharacterAttribute[],
  ): CharacterAttribute[] {
    const attributeMap = new Map<string, CharacterAttribute>();

    for (const attr of attributes) {
      // Create unique key from category + name
      const key = `${attr.category}:${attr.name}`;

      if (attributeMap.has(key)) {
        // Merge evidence into existing attribute
        const existing = attributeMap.get(key)!;
        existing.evidence = [...existing.evidence, ...attr.evidence];
      } else {
        // First occurrence - create new entry with evidence copy
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
   * OLD: Convert cached indicator data to absolute indicator matches
   * Kept for future use but not currently called
   */
  private static sentenceCacheToIndicatorMatches(
    sentenceCache: SentenceCache,
    sentenceIndex: number,
    sentenceStartIndex: number,
  ): Map<string, CharacterIndicators> {
    const indicatorsByCharacter = new Map<string, CharacterIndicators>();

    for (const [characterName, indicators] of Object.entries(
      sentenceCache.characterIndicators || {},
    )) {
      const characterIndicators: CharacterIndicators = {
        directDefinition: [],
        actions: [],
        speech: [],
        appearance: [],
        environment: [],
      };

      // Convert each indicator type
      const indicatorTypes: IndicatorType[] = [
        "directDefinition",
        "actions",
        "speech",
        "appearance",
        "environment",
      ];

      for (const type of indicatorTypes) {
        const refs = indicators[type] || [];
        characterIndicators[type] = refs.map((ref) => ({
          sentenceIndex,
          startIndex: sentenceStartIndex + ref.relativeIndex,
          endIndex: sentenceStartIndex + ref.relativeIndex + ref.text.length,
          text: ref.text,
          type,
        }));
      }

      indicatorsByCharacter.set(characterName, characterIndicators);
    }

    return indicatorsByCharacter;
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
            const evidenceRefs: AttributeEvidenceRef[] = [];

            for (const ev of attr.evidence) {
              // Find all occurrences of this evidence text in the sentence
              const indices = TextUtils.findAllWordMatches(sentence, ev.text);
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
   * OLD INDICATOR EXTRACTION METHOD - Kept for future use but not currently called
   * Extract indicators for a character in a sentence
   * @param story - Full story text (for context)
   * @param characterName - Character to analyze
   * @param sentence - Sentence text
   * @param coreferences - List of coreferences found for this character
   * @returns SentenceCharacterIndicators object
   */
  /*
  private static async extractIndicatorsForCharacter(
    story: string,
    characterName: string,
    sentence: string,
    coreferences: string[],
  ): Promise<SentenceCharacterIndicators> {
    const indicatorTypes: IndicatorType[] = [
      "directDefinition",
      "actions",
      "speech",
      "appearance",
      "environment",
    ];

    const indicators: SentenceCharacterIndicators = {
      directDefinition: [],
      actions: [],
      speech: [],
      appearance: [],
      environment: [],
    };

    // Only process if there are coreferences in this sentence
    if (coreferences.length === 0) {
      return indicators;
    }

    // Call all 5 indicator APIs in parallel
    await Promise.all(
      indicatorTypes.map(async (type) => {
        try {
          const apiPath = type === "directDefinition"
            ? "direct-definition"
            : type;

          const response = await fetch(`/api/indicators/${apiPath}`, {
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
              `Failed to extract ${type} indicators for ${characterName}`,
            );
            return;
          }

          const data = await response.json();
          const indicatorTexts: string[] = data.indicators || [];

          // Convert indicator texts to relative indices
          const refs: SentenceIndicatorRef[] = [];
          for (const indicatorText of indicatorTexts) {
            const indices = TextUtils.findAllWordMatches(sentence, indicatorText);
            for (const relativeIndex of indices) {
              refs.push({
                text: indicatorText,
                relativeIndex,
              });
            }
          }

          indicators[type] = refs;
        } catch (error) {
          console.error(
            `Error extracting ${type} indicators for ${characterName}:`,
            error,
          );
        }
      }),
    );

    return indicators;
  }
  */

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

          // Step 2: Extract attributes (NEW - using Egri's bone structure)
          const attributes = await this.extractAttributesForCharacter(
            story,
            characterName,
            sentence.text,
            coreferences,
          );
          characterAttributes[characterName] = attributes;

          // OLD: Extract indicators (commented out but kept for future use)
          /*
          if (extractIndicators) {
            const indicators = await this.extractIndicatorsForCharacter(
              story,
              characterName,
              sentence.text,
              coreferences,
            );
            characterIndicators[characterName] = indicators;
          } else {
          */
          characterIndicators[characterName] = {
            directDefinition: [],
            actions: [],
            speech: [],
            appearance: [],
            environment: [],
          };
          /*
          }
          */
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
        this.processSentence(
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

      // Merge attributes into character map
      attributes.forEach((attributeList, characterName) => {
        const existing = characterAttributeMap.get(characterName) || [];
        characterAttributeMap.set(characterName, [
          ...existing,
          ...attributeList,
        ]);
      });

      // OLD: Convert indicators (kept for backward compatibility but empty)
      const indicators = this.sentenceCacheToIndicatorMatches(
        sentenceCache,
        sentIndex,
        sentences[sentIndex].startIndex,
      );

      // Merge indicators into character map
      indicators.forEach((indicatorData, characterName) => {
        const existing = characterIndicatorMap.get(characterName)!;
        const indicatorTypes: IndicatorType[] = [
          "directDefinition",
          "actions",
          "speech",
          "appearance",
          "environment",
        ];

        for (const type of indicatorTypes) {
          existing[type] = [...existing[type], ...indicatorData[type]];
        }

        characterIndicatorMap.set(characterName, existing);
      });
    }

    // Convert map to Character array and consolidate duplicate attributes
    const characters: Character[] = characterNames.map((name) => ({
      name,
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
