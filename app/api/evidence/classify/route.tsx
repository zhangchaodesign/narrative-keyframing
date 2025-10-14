import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const ClassificationSchema = z.object({
  result: z
    .enum(["matching", "conflicting", "irrelevant"])
    .describe(
      "Whether this phrase matches, conflicts with, or is irrelevant to existing attributes",
    ),
  matchedAttributeId: z
    .string()
    .optional()
    .describe(
      "If matching: the ID/key of the matched attribute (format: 'category-name'); empty if none",
    ),
  conflictAttributeId: z
    .string()
    .optional()
    .describe(
      "If conflicting: the ID/key of the conflicting attribute (format: 'category-name'); empty if none",
    ),
  conflictReason: z
    .string()
    .optional()
    .describe(
      "If conflicting: brief explanation of why this conflicts with the existing attribute; empty if none",
    ),
  conflictSeverity: z
    .enum(["low", "medium", "high", "none"])
    .optional()
    .describe("If conflicting: severity level of the contradiction"),
});

export async function POST(request: Request) {
  try {
    const { story, sentence, characterName, phrase, existingAttributes } =
      await request.json();

    if (
      !story ||
      !sentence ||
      !characterName ||
      !phrase ||
      !existingAttributes
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Format existing attributes for the prompt
    const attributesList =
      existingAttributes.length === 0
        ? "No existing attributes"
        : existingAttributes
            .map(
              (attr: any) =>
                `- ${attr.category}: "${attr.name}" (${
                  attr.evidence?.length || 0
                } evidence)`,
            )
            .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ClassificationSchema,
      prompt: `You are an expert in literary character analysis. Your task is to classify whether a piece of evidence matches, conflicts with, or is irrelevant to existing character attributes.

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Evidence phrase to classify: "${phrase}"

Existing attributes for ${characterName}:
${attributesList}

Classification Rules:

1. **matching**: The phrase supports or is consistent with an existing attribute
   - The phrase describes the same quality/trait as an existing attribute
   - It provides additional evidence for something already established
   - Example: Existing "tall" + Phrase "towered over others" = matching
   - Return: matchedAttributeId (format: "category-name", e.g., "physiology-tall")

2. **conflicting**: The phrase contradicts an existing attribute
   - The phrase describes an opposite or incompatible quality
   - It directly contradicts established information
   - Example: Existing "brave" + Phrase "cowered in fear" = conflicting
   - Return: conflictAttributeId, conflictReason, conflictSeverity

3. **irrelevant**: The phrase describes something new or unrelated
   - Not covered by existing attributes
   - Describes a different aspect of the character
   - Example: Existing "tall" + Phrase "spoke softly" = irrelevant
   - This will trigger attribute inference in the next step

Important:
- Be precise: only mark as matching if it truly supports an existing attribute
- Be strict: only mark as conflicting if there's a clear contradiction
- When in doubt between matching and irrelevant, choose irrelevant
- Consider context from the story to understand nuance

Classify this evidence phrase.`,
      temperature: 0.3,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error classifying evidence:", error);
    return NextResponse.json(
      { error: "Failed to classify evidence" },
      { status: 500 },
    );
  }
}
