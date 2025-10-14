import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const InferenceSchema = z.object({
  hasAttribute: z
    .boolean()
    .describe("Whether this phrase reveals an attribute in the given category"),
  attributeName: z
    .string()
    .optional()
    .describe(
      "If hasAttribute is true: the inferred attribute name (e.g., 'tall', 'brave', 'wealthy')",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "If hasAttribute is true: confidence level (0-1) in this inference",
    ),
});

const categoryDefinitions = {
  physiology: `PHYSIOLOGY attributes include:
- Age (young, middle-aged, elderly, etc.)
- Physical appearance (height, build, hair color, eye color, skin tone)
- Physical characteristics (posture, gait, facial features)
- Health and physical condition
- Physical mannerisms and movements`,

  psychology: `PSYCHOLOGY attributes include:
- Personality traits (brave, timid, kind, cruel, etc.)
- Emotional states and temperament
- Mental characteristics (intelligent, wise, cunning, etc.)
- Attitudes and beliefs
- Character motivations and desires`,

  sociology: `SOCIOLOGY attributes include:
- Social status and class (wealthy, poor, noble, etc.)
- Occupation and role in society
- Relationships and social connections
- Cultural background and upbringing
- Education level and manners`,
};

export async function POST(request: Request) {
  try {
    const { story, sentence, characterName, phrase, category } =
      await request.json();

    if (!story || !sentence || !characterName || !phrase || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const validCategories = ["physiology", "psychology", "sociology"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: InferenceSchema,
      prompt: `You are an expert in literary character analysis using Egri's "bone structure" framework.

Your task is to determine if a piece of evidence reveals a **${category.toUpperCase()}** attribute for a character.

${categoryDefinitions[category as keyof typeof categoryDefinitions]}

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Evidence phrase: "${phrase}"

Question: Does this phrase reveal a ${category} attribute for ${characterName}?

Rules:
1. Only infer attributes that are clearly supported by this phrase
2. Be conservative - if uncertain, set hasAttribute to false
3. The attribute name should be a simple adjective or noun (e.g., "tall", "brave", "wealthy")
4. Provide a confidence score (0-1) based on how strongly the phrase supports the inference
5. Consider the full story context to avoid misinterpretation

Analyze this phrase and determine if it reveals a ${category} attribute.`,
      temperature: 0.3,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error inferring attribute:", error);
    return NextResponse.json(
      { error: "Failed to infer attribute" },
      { status: 500 },
    );
  }
}
