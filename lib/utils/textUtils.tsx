import * as Diff from "diff";

export class TextUtils {
  /**
   * Find all the matching strings in str and return their starting indices
   * @param str
   * @param search
   * @returns
   */
  static findAllMatches(str: string, search: string): number[] {
    const indices: number[] = [];
    let startIndex = 0;
    let index;

    if (search.length === 0) return indices;

    while ((index = str.indexOf(search, startIndex)) > -1) {
      indices.push(index);
      startIndex = index + search.length;
    }

    return indices;
  }

  /**
   * Find all whole-word matches (respecting word boundaries) in str
   * Uses fuzzy matching by normalizing both strings (removes special chars, lowercases)
   * This prevents matching "he" inside "the", but allows matching "hugging her knees."
   * even with punctuation differences
   *
   * Implementation based on matchActionsToText from anotherTextUtils.ts
   *
   * @param str - The text to search in
   * @param search - The phrase/word to search for
   * @returns Array of starting indices where the phrase appears in the original text
   */
  static findAllWordMatches(str: string, search: string): number[] {
    const indices: number[] = [];

    if (search.length === 0) return indices;

    // Normalize both strings for comparison (like matchActionsToText does)
    const normalizedStr = this.prepareStringForMatching(str);
    const normalizedSearch = this.prepareStringForMatching(search);

    // Find all matches in the normalized string
    let searchStartIndex = 0;
    let matchIndex;

    while (
      (matchIndex = normalizedStr.indexOf(normalizedSearch, searchStartIndex)) >
      -1
    ) {
      // Now map the normalized index back to the original string
      // We need to count characters in both strings simultaneously
      let normalizedPos = 0;
      let originalPos = 0;

      // Walk through original string until we reach the match position in normalized string
      while (normalizedPos < matchIndex && originalPos < str.length) {
        const char = str[originalPos];
        if (/[a-zA-Z0-9]/.test(char)) {
          // This character appears in normalized string
          normalizedPos++;
        } else {
          // This character becomes a space in normalized string
          normalizedPos++;
        }
        originalPos++;
      }

      // originalPos now points to the start of the match in the original string
      indices.push(originalPos);

      // Continue searching after this match
      searchStartIndex = matchIndex + normalizedSearch.length;
    }

    return indices;
  }

  /**
   * Clean up a string to make it easier to be matched against (mostly for GPT because it seems to mess with special characters)
   * @param str
   * @param replacement
   * @returns
   */
  static prepareStringForMatching(str: string, replacement = " "): string {
    return str.replace(/[^a-zA-Z0-9]/g, replacement).toLocaleLowerCase();
  }

  /**
   * Split text into sentences and track their start indices in the original text
   * @param text - The full text to split
   * @returns Array of sentences with their start indices
   */
  static splitIntoSentences(
    text: string,
  ): Array<{ text: string; startIndex: number }> {
    const sentences: Array<{ text: string; startIndex: number }> = [];

    // Simple sentence splitting on . ! ? followed by space or end of string
    // This regex captures the sentence including the punctuation
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      sentences.push({
        text: match[0],
        startIndex: match.index,
      });
    }

    // Handle case where text doesn't end with sentence-ending punctuation
    const lastSentenceEnd =
      sentences.length > 0
        ? sentences[sentences.length - 1].startIndex +
          sentences[sentences.length - 1].text.length
        : 0;

    if (lastSentenceEnd < text.length) {
      const remainingText = text.substring(lastSentenceEnd).trim();
      if (remainingText.length > 0) {
        sentences.push({
          text: remainingText,
          startIndex: text.indexOf(remainingText, lastSentenceEnd),
        });
      }
    }

    return sentences;
  }
}
