import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Finds all occurrences of a snippet within a text and returns their ranges
 * @param text - The text to search within
 * @param snippet - The snippet to find
 * @returns Array of ranges with start and end positions
 */
export function findTextMatches(
  text: string,
  snippet: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  if (!snippet || snippet.trim().length === 0) {
    return ranges;
  }

  let searchIndex = 0;
  const snippetLength = snippet.length;

  while (searchIndex <= text.length - snippetLength) {
    const matchIndex = text.indexOf(snippet, searchIndex);
    if (matchIndex === -1) {
      break;
    }
    ranges.push({ start: matchIndex, end: matchIndex + snippetLength });
    searchIndex = matchIndex + snippetLength;
  }

  return ranges;
}
