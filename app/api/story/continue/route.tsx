"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const IndicatorTypeSchema = z.enum([
  "directDefinition",
  "actions",
  "speech",
  "appearance",
  "environment",
]);

const AttributeCategorySchema = z.enum([
  "physiology",
  "psychology",
  "sociology",
]);

const EvidenceSnippetSchema = z.object({
  indicatorType: IndicatorTypeSchema,
  text: z.string().min(1),
});

const AttributeSelectionSchema = z.object({
  name: z.string().min(1),
  category: AttributeCategorySchema,
  evidenceTypes: z.array(IndicatorTypeSchema).min(1),
  evidenceSnippets: z.array(EvidenceSnippetSchema),
});

const RequestSchema = z.object({
  story: z.string().min(1),
  characterName: z.string().min(1),
  attributes: z.array(AttributeSelectionSchema).min(1),
});

const ContinuationSchema = z.object({
  sentence: z
    .string()
    .min(1)
    .describe("A single sentence that continues the story"),
});

const INDICATOR_LABELS: Record<z.infer<typeof IndicatorTypeSchema>, string> = {
  directDefinition: "Direct Definition",
  actions: "Actions",
  speech: "Speech",
  appearance: "Appearance",
  environment: "Environment",
};

const CATEGORY_LABELS: Record<
  z.infer<typeof AttributeCategorySchema>,
  string
> = {
  physiology: "Physiology",
  psychology: "Psychology",
  sociology: "Sociology",
};

function buildAttributeSection(
  attributes: z.infer<typeof AttributeSelectionSchema>[],
): string {
  return attributes
    .map((attribute, index) => {
      const evidenceTypes = attribute.evidenceTypes
        .map((type) => INDICATOR_LABELS[type])
        .join(", ");

      const evidenceExamples =
        attribute.evidenceSnippets.length > 0
          ? attribute.evidenceSnippets
              .map(
                (snippet, idx) =>
                  `  ${index + 1}.${idx + 1}. (${INDICATOR_LABELS[snippet.indicatorType]}) ${snippet.text}`,
              )
              .join("\n")
          : "  No direct evidence snippets available; you may invent fitting evidence.";

      return `Attribute ${index + 1}: ${attribute.name} (${CATEGORY_LABELS[attribute.category]})
Evidence styles required: ${evidenceTypes}
Reference evidence snippets:
${evidenceExamples}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const { story, characterName, attributes } = payload.data;
    const trimmedStory = story.trim();
    if (!trimmedStory) {
      return NextResponse.json(
        { error: "Story cannot be empty" },
        { status: 400 },
      );
    }

    const maxContextLength = 5000;
    const storyContext =
      trimmedStory.length > maxContextLength
        ? trimmedStory.slice(-maxContextLength)
        : trimmedStory;

    const attributeSection = buildAttributeSection(attributes);

    const prompt = `You are an expert fiction ghostwriter continuing a story.

Story so far (most recent text last):
${storyContext}

Task:
Write exactly ONE new sentence that continues the narrative.
The sentence must feature ${characterName} and demonstrate the requested attributes using the specified evidence styles.

Attributes to highlight:
${attributeSection}

Guidelines:
- Maintain the existing narrative voice, tense, and point of view.
- If "Direct Definition" is requested, you may explicitly describe the character.
- If "Actions" is requested, show the character acting in a way that reveals the attribute.
- If "Speech" is requested, include dialogue or quoted speech that showcases the attribute.
- If "Appearance" is requested, include physical or stylistic details.
- If "Environment" is requested, weave in surroundings or setting elements that reinforce the attribute.
- Combine multiple evidence styles naturally within the single sentence when needed.
- Do not contradict the established story or previously provided evidence.
- Do not restate the instructions or provide analysis—return only the single sentence continuation.
`;

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ContinuationSchema,
      prompt,
    });

    if (!object || !object.sentence) {
      return NextResponse.json(
        { error: "Failed to generate continuation" },
        { status: 500 },
      );
    }

    const sentence = object.sentence.trim();
    if (!sentence) {
      return NextResponse.json(
        { error: "Model returned an empty sentence" },
        { status: 500 },
      );
    }

    return NextResponse.json({ sentence });
  } catch (error) {
    console.error("Error generating story continuation:", error);
    return NextResponse.json(
      { error: "Unable to generate story continuation" },
      { status: 500 },
    );
  }
}
