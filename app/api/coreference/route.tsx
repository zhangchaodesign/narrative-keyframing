import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { story, characterName, sentence } = await req.json();

  if (!story || !characterName || !sentence) {
    return NextResponse.json(
      { error: "story, characterName, and sentence are required" },
      { status: 400 },
    );
  }

  try {
    // Extract coreference mentions for the character in the given sentence
    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: z.object({
        coreferences: z.array(z.string()),
      }),
      prompt: `Given the full story context and a specific sentence, identify ALL words or phrases in the sentence that refer to the character "${characterName}".

Full story context:
${story}

Sentence to analyze:
"${sentence}"

Character name: ${characterName}

Instructions:
1. Return ONLY the exact words/phrases from the sentence that refer to this character (e.g., "he", "she", "him", "her", "his", "John", "the boy", etc.)
2. Return each word/phrase separately in the array
3. Do NOT return indices or positions - only the text itself
4. If the character name appears in the sentence, include it
5. If there are no references to this character in the sentence, return an empty array

Examples:
- If sentence is "John went to the store. He bought milk." and character is "John", return ["John", "He"]
- If sentence is "She gave him the book." and character is "Mary", return ["She"] (assuming Mary is the subject based on context)
- If sentence is "The weather was nice." and character is "John", return []`,
    });

    return NextResponse.json({ coreferences: object.coreferences });
  } catch (error) {
    console.error("Coreference extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract coreferences" },
      { status: 500 },
    );
  }
}
