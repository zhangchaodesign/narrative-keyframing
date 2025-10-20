import { TextUtils } from "./textUtils";
import { EvidenceProcessor } from "./evidenceProcessor";
import type { Character, CoreferenceMatch } from "../stores/characterStore";
import type { SentenceCache } from "../stores/sentenceCacheStore";
import type { CharacterIndicators } from "../types/indicators";
import type {
  AttributeCategory,
  CharacterAttribute,
  AttributeEvidence,
} from "../types/attributes";
import type { AttributeConflict, ConflictSeverity } from "../types/conflicts";

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
        for (const ev of attr.evidence) {
          this.addEvidenceIfNewByText(existing, ev);
        }
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
          // Capture evidence text; positions are resolved on demand
          const evidence: AttributeEvidence[] = attr.evidence.map((ev) => ({
            text: ev.text,
            indicatorType: ev.indicatorType,
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

  static addEvidenceIfNewByText(
    existingAttr: CharacterAttribute,
    newRef: AttributeEvidence,
  ): void {
    const a = TextUtils.prepareStringForMatching(newRef.text) ?? "";
    if (!a) return;

    const isDup = existingAttr.evidence.some((e) => {
      const b = TextUtils.prepareStringForMatching(e.text) ?? "";
      if (!b) return false;

      // Fallback using word-boundary matcher
      // console.log(`Checking evidence duplication: "${a}" vs "${b}"`);
      const ab = TextUtils.findAllWordMatches(b, a);
      const ba = TextUtils.findAllWordMatches(a, b);
      // if ab or ba has ANY matches, consider it a dup
      return ab.length > 0 || ba.length > 0;
    });

    if (!isDup) existingAttr.evidence.push(newRef);
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
  static async detectSentenceConflicts(
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

    const cachedCharacterSet = new Set(cachedCharacterNames || []);
    const newCharacterNames = characterNames.filter(
      (name) => !cachedCharacterSet.has(name),
    );
    const removedCharacterNames = cachedCharacterNames
      ? cachedCharacterNames.filter((name) => !characterNames.includes(name))
      : [];
    const hasNewCharacters = newCharacterNames.length > 0;

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

    const sentencesToProcessFully = [...newIndices];
    const sentencesToProcessFullySet = new Set(sentencesToProcessFully);
    const sentencesToProcessPartially =
      hasNewCharacters && sentences.length > 0
        ? sentences
            .map((_, index) => index)
            .filter((index) => !sentencesToProcessFullySet.has(index))
        : [];

    console.log(
      `Processing ${sentencesToProcessFully.length} sentences fully and ${
        sentencesToProcessPartially.length
      } sentences for new characters (${newCharacterNames.join(", ")})`,
    );
    if (removedCharacterNames.length > 0) {
      console.log("Removed characters detected:", removedCharacterNames);
    }

    // Process sentences that need updating in parallel
    console.log("existingCharacters:", existingCharacters);

    const fullyProcessedMap = new Map<number, SentenceCache>();
    if (sentencesToProcessFully.length > 0) {
      const fullyProcessedCaches = await Promise.all(
        sentencesToProcessFully.map((sentIndex) =>
          EvidenceProcessor.processSentenceEvidenceFirst(
            story,
            sentences[sentIndex],
            sentIndex,
            characterNames,
            existingCharacters || [],
          ),
        ),
      );

      sentencesToProcessFully.forEach((sentenceIndex, idx) => {
        const processed = fullyProcessedCaches[idx];
        fullyProcessedMap.set(sentenceIndex, processed);
      });

      console.log("Fully processed caches:", fullyProcessedMap);
    }

    const partiallyProcessedMap = new Map<number, SentenceCache>();
    if (sentencesToProcessPartially.length > 0 && hasNewCharacters) {
      const partiallyProcessedCaches = await Promise.all(
        sentencesToProcessPartially.map((sentIndex) =>
          EvidenceProcessor.processSentenceEvidenceFirst(
            story,
            sentences[sentIndex],
            sentIndex,
            newCharacterNames,
            existingCharacters || [],
          ),
        ),
      );

      sentencesToProcessPartially.forEach((sentenceIndex, idx) => {
        const processed = partiallyProcessedCaches[idx];
        partiallyProcessedMap.set(sentenceIndex, processed);
      });

      console.log("Partially processed caches:", partiallyProcessedMap);
    }

    // Build the final cache array
    const newCache: SentenceCache[] = [];
    const allowedCharacters = new Set(characterNames);

    for (let i = 0; i < sentences.length; i++) {
      if (fullyProcessedMap.has(i)) {
        newCache[i] = fullyProcessedMap.get(i)!;
        continue;
      }

      const cachedIndex = cacheMapping.get(i);
      const baseCache =
        cachedIndex !== null && cachedIndex !== undefined
          ? cache[cachedIndex]
          : undefined;

      const filteredCharacterRefs = baseCache?.characterRefs
        ? Object.fromEntries(
            Object.entries(baseCache.characterRefs).filter(([name]) =>
              allowedCharacters.has(name),
            ),
          )
        : {};
      const filteredCharacterIndicators = baseCache?.characterIndicators
        ? Object.fromEntries(
            Object.entries(baseCache.characterIndicators).filter(([name]) =>
              allowedCharacters.has(name),
            ),
          )
        : {};
      const filteredCharacterAttributes = baseCache?.characterAttributes
        ? Object.fromEntries(
            Object.entries(baseCache.characterAttributes).filter(([name]) =>
              allowedCharacters.has(name),
            ),
          )
        : {};

      const mergedCache: SentenceCache = {
        text: sentences[i].text,
        characterRefs: filteredCharacterRefs,
        characterIndicators: filteredCharacterIndicators,
        characterAttributes: filteredCharacterAttributes,
      };

      const partialCache = partiallyProcessedMap.get(i);
      if (partialCache) {
        mergedCache.characterRefs = {
          ...mergedCache.characterRefs,
          ...partialCache.characterRefs,
        };
        mergedCache.characterIndicators = {
          ...mergedCache.characterIndicators,
          ...partialCache.characterIndicators,
        };
        mergedCache.characterAttributes = {
          ...mergedCache.characterAttributes,
          ...partialCache.characterAttributes,
        };
      }

      newCache[i] = mergedCache;
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
      conflicts: [],
    }));

    return {
      characters,
      sentenceCaches: newCache,
    };
  }
}
