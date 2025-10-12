import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const EvidenceSchema = z.object({
  text: z.string().describe("Exact verbatim text from the sentence"),
  indicatorType: z
    .enum([
      "directDefinition",
      "actions",
      "speech",
      "appearance",
      "environment",
    ])
    .describe("Type of indicator this evidence represents"),
});

const AttributeSchema = z.object({
  name: z
    .string()
    .describe("The attribute name (e.g., 'elderly', 'tall', 'athletic')"),
  evidence: z
    .array(EvidenceSchema)
    .describe("All evidence supporting this attribute"),
});

export async function POST(request: Request) {
  try {
    const { story, characterName, sentence, coreferences } =
      await request.json();

    if (!story || !characterName || !sentence || !coreferences) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: z.object({
        attributes: z.array(AttributeSchema),
      }),
      prompt: `You are an expert in literary character analysis using Egri's "bone structure" framework.

Your task is to identify PHYSIOLOGY attributes for a character from a sentence.

PHYSIOLOGY Category includes:
- Age (young, middle-aged, elderly, etc.)
- Physical appearance (height, build, hair color, eye color, skin tone)
- Physical characteristics (posture, gait, facial features)
- Health and physical condition
- Physical mannerisms

For each physiology attribute you identify:
1. Infer the attribute name (e.g., "elderly", "tall", "blonde", "athletic")
2. Find ALL verbatim evidence from the sentence that supports this attribute
3. Categorize each piece of evidence by indicator type:
   - directDefinition: Explicit statements (e.g., "old man", "tall")
   - actions: Physical actions revealing the trait (e.g., "moved slowly")
   - speech: Dialogue/speech patterns revealing the trait
   - appearance: Visual descriptions (e.g., "gray hair", "wrinkled skin")
   - environment: Surroundings that suggest the trait

Rules:
- Only return attributes you can clearly infer from the sentence
- Evidence must be EXACT verbatim text from the sentence
- Each evidence piece must have exactly one indicator type
- Return empty array if no physiology attributes can be inferred
- Focus on the target character, not others in the sentence

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Analyze this sentence and identify all PHYSIOLOGY attributes for ${characterName}. For each attribute, provide the attribute name and all verbatim evidence with indicator types.`,
      temperature: 0.3,
    });
    console.log(
      "Extracted physiology attributes:",
      object.attributes,
      characterName,
      sentence,
    );

    return NextResponse.json({ attributes: object.attributes });
  } catch (error) {
    console.error("Error extracting physiology attributes:", error);
    return NextResponse.json(
      { error: "Failed to extract physiology attributes" },
      { status: 500 },
    );
  }
}
