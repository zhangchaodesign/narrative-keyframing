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
   * Clean up a string to make it easier to be matched against (mostly for GPT because it seems to mess with special characters)
   * @param str
   * @param replacement
   * @returns
   */
  static prepareStringForMatching(str: string, replacement = " "): string {
    return str.replace(/[^a-zA-Z0-9]/g, replacement).toLocaleLowerCase();
  }
}
