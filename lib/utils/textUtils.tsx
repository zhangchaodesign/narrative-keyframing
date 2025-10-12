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
   * This prevents matching "he" inside "the", etc.
   * @param str - The text to search in
   * @param search - The word to search for
   * @returns Array of starting indices where the word appears as a complete word
   */
  static findAllWordMatches(str: string, search: string): number[] {
    const indices: number[] = [];

    if (search.length === 0) return indices;

    // Create a regex with word boundaries
    // \b ensures we only match complete words
    const regex = new RegExp(`\\b${this.escapeRegExp(search)}\\b`, "gi");
    let match;

    while ((match = regex.exec(str)) !== null) {
      indices.push(match.index);
    }

    return indices;
  }

  /**
   * Escape special regex characters in a string
   * @param str - String to escape
   * @returns Escaped string safe for use in RegExp
   */
  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
