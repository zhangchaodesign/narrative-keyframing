import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const ResolutionSchema = z.object({
  revisedSentence: z
    .string()
    .describe("Sentence rewritten to resolve the conflict"),
  rationale: z.string().optional().describe("Short explanation of the change"),
});

export async function POST(request: Request) {
  try {
    const {
      characterName,
      originalSentence,
      attributeName,
      attributeCategory,
      conflictingEvidence,
      establishedEvidence,
    } = await request.json();

    if (!originalSentence || !attributeName || !conflictingEvidence) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const prompt = `You are an expert fiction editor fixing a characterization inconsistency.

Rewrite the provided SENTENCE so it no longer contradicts the established character attribute.

Constraints:
- Preserve the intent of the original sentence whenever possible.
- Avoid introducing new contradictions.
- Keep the result as a single, coherent sentence.
- Use the same narrative point of view and tense.

Context:
- Character: ${characterName || "Unknown"}
- Established Attribute (${
      attributeCategory || "attribute"
    }): "${attributeName}" backed by evidence: "${establishedEvidence || "N/A"}"
- Conflicting Evidence: "${conflictingEvidence}"
- Original Sentence: "${originalSentence}"

Return only the revised sentence that resolves the conflict.`;

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResolutionSchema,
      prompt,
    });

    if (!object || !object.revisedSentence) {
      return NextResponse.json(
        { error: "Failed to generate a revised sentence" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      revisedSentence: object.revisedSentence.trim(),
      rationale: object.rationale,
    });
  } catch (error) {
    console.error("Error generating conflict resolution:", error);
    return NextResponse.json(
      { error: "Failed to generate sentence revision" },
      { status: 500 },
    );
  }
}
