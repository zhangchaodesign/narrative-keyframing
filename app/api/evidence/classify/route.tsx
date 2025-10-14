import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const ClassificationSchema = z.object({
  result: z
    .enum(["relevant", "irrelevant"])
    .describe(
      "Whether this phrase is relevant to character attributes (relevant) or not (irrelevant).",
    ),
  matchedAttributeId: z
    .string()
    .optional()
    .describe(
      "If relevant: the ID/key of the matched attribute (format: 'category-name'); empty if none",
    ),
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
                } evidence)${attr.id ? ` [id: ${attr.id}]` : ""}`,
            )
            .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ClassificationSchema,
      prompt: `You are an expert in literary character analysis. Classify whether the evidence phrase is RELEVANT or IRRELEVANT to character attributes.

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Evidence phrase to classify: "${phrase}"

Existing attributes for ${characterName}:
${attributesList}

Binary Classification Rules:

- **relevant**: The phrase characterizes the person (traits, motivations, physiology, skills, relationships, values, stable emotions) and
  - either supports/aligns with an existing attribute, or
  - contradicts an existing attribute
  - Example: Existing "tall" + Phrase "towered over others" = relevant 
  - Return: matchedAttributeId (format: "category-name", e.g., "physiology-tall")

- **irrelevant**: The phrase describes something new or unrelated 
  - Not covered by existing attributes 
  - Describes a different aspect of the character 
  - Example: Existing "tall" + Phrase "spoke softly" = irrelevant 
  - This will trigger attribute inference in the next step

Important: 
- Be precise: only mark as relevant if it truly supports an existing attribute 
- When in doubt between relevant and irrelevant, choose irrelevant 
- Consider context from the story to understand nuance`,
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
