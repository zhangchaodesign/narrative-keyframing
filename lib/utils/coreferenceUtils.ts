import { TextUtils } from "./textUtils";
import type { Character, CoreferenceMatch } from "../stores/characterStore";

export class CoreferenceUtils {
  /**
   * Extract coreference mentions for all characters in a story
   * @param story - The full story text
   * @param characterNames - Array of character names to track
   * @returns Array of Character objects with coreference matches
   */
  static async extractAllCoreferences(
    story: string,
    characterNames: string[],
  ): Promise<Character[]> {
    const sentences = TextUtils.splitIntoSentences(story);
    const characters: Character[] = characterNames.map((name) => ({
      name,
      coreferenceMatches: [],
    }));

    // Process all characters in parallel
    await Promise.all(
      characters.map(async (character) => {
        // Process all sentences for this character in parallel
        const sentenceResults = await Promise.all(
          sentences.map(async (sentence, sentIndex) => {
            try {
              // Call API to get coreference strings for this character in this sentence
              const response = await fetch("/api/coreference", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  story,
                  characterName: character.name,
                  sentence: sentence.text,
                }),
              });

              if (!response.ok) {
                console.error(
                  `Failed to extract coreferences for ${character.name} in sentence ${sentIndex}`,
                );
                return [];
              }

              const data = await response.json();
              const coreferences: string[] = data.coreferences || [];

              // For each coreference string, find its index in the full story
              const matches: CoreferenceMatch[] = [];
              for (const corefText of coreferences) {
                // Find all occurrences of this coreference text in the sentence
                // Use word boundary matching to avoid partial matches (e.g., "he" in "the")
                const sentenceStartInStory = sentence.startIndex;
                const indices = TextUtils.findAllWordMatches(
                  sentence.text,
                  corefText,
                );

                // Convert sentence-relative indices to story-absolute indices
                for (const relativeIndex of indices) {
                  const absoluteStartIndex =
                    sentenceStartInStory + relativeIndex;
                  matches.push({
                    sentenceIndex: sentIndex,
                    startIndex: absoluteStartIndex,
                    endIndex: absoluteStartIndex + corefText.length,
                    text: corefText,
                  });
                }
              }

              return matches;
            } catch (error) {
              console.error(
                `Error processing sentence ${sentIndex} for character ${character.name}:`,
                error,
              );
              return [];
            }
          }),
        );

        // Flatten all matches from all sentences
        character.coreferenceMatches = sentenceResults.flat();
      }),
    );

    return characters;
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
