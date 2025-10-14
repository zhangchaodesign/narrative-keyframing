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
   * Clean up a string to make it easier to be matched against
   * @param str
   * @param replacement
   * @returns
   */
  static prepareStringForMatching(str: string, replacement = " "): string {
    return str.replace(/[^a-zA-Z0-9]/g, replacement).toLocaleLowerCase();
  }

  private static escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Whole-word/phrase matcher that:
   * - does NOT match inside other words (no "he" in "the"/"she")
   * - DOES match phrases containing punctuation/smart quotes (e.g., “I’m a pacifist,”)
   * - is Unicode-aware (handles curly apostrophes/quotes)
   */
  static findAllWordMatches(
    str: string,
    search: string,
    {
      caseSensitive = false,
      allowApostrophesInsideWords = true, // keep ’ or ' inside words like I’m
    }: { caseSensitive?: boolean; allowApostrophesInsideWords?: boolean } = {},
  ): number[] {
    const indices: number[] = [];
    if (!search || !search.trim()) return indices;

    // Split search into tokens by whitespace, but KEEP punctuation inside tokens.
    const tokens = search.trim().split(/\s+/).map(this.escapeRegex);
    if (!tokens.length) return indices;

    // What counts as a "word character" for boundaries:
    const wordChar = allowApostrophesInsideWords
      ? `[\\p{L}\\p{N}'’]`
      : `[\\p{L}\\p{N}]`;

    // Allow ANY run of non-letter/digit (spaces, punctuation, quotes) between tokens.
    const between = `(?:[^\\p{L}\\p{N}]+)`;
    const inner = tokens.join(between);

    // Require non-word on both ends (so we don't match inside larger words).
    const pattern = `(?<!${wordChar})${inner}(?!${wordChar})`;
    const flags = `g${caseSensitive ? "u" : "iu"}`;

    const re = new RegExp(pattern, flags);

    for (let m: RegExpExecArray | null; (m = re.exec(str)); ) {
      indices.push(m.index);
      if (re.lastIndex === m.index) re.lastIndex++; // safety
    }
    return indices;
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
