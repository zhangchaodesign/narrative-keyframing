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
    .describe(
      "The attribute name (e.g., 'nervous', 'ambitious', 'kind', 'intelligent')",
    ),
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

Your task is to identify PSYCHOLOGY attributes for a character from a sentence.

PSYCHOLOGY Category includes:
- Personality traits (nervous, confident, shy, aggressive, kind, etc.)
- Emotional states (anxious, happy, angry, sad, excited, etc.)
- Values and beliefs (honest, loyal, ambitious, compassionate, etc.)
- Skills and abilities (intelligent, creative, analytical, etc.)
- Attitudes and temperament
- Mental characteristics

For each psychology attribute you identify:
1. Infer the attribute name (e.g., "nervous", "ambitious", "kind", "intelligent")
2. Find ALL verbatim evidence from the sentence that supports this attribute
3. Categorize each piece of evidence by indicator type:
   - directDefinition: Explicit statements (e.g., "was nervous", "intelligent person")
   - actions: Behaviors revealing the trait (e.g., "tapped his foot", "solved the puzzle quickly")
   - speech: What they say revealing the trait (e.g., dialogue showing kindness)
   - appearance: Visual cues suggesting mental state (e.g., "furrowed brow")
   - environment: Surroundings reflecting psychology (e.g., "organized desk")

Rules:
- Only return attributes you can clearly infer from the sentence
- Evidence must be EXACT verbatim text from the sentence
- Each evidence piece must have exactly one indicator type
- Return empty array if no psychology attributes can be inferred
- Focus on the target character, not others in the sentence

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Analyze this sentence and identify all PSYCHOLOGY attributes for ${characterName}. For each attribute, provide the attribute name and all verbatim evidence with indicator types.`,
      temperature: 0.3,
    });

    return NextResponse.json({ attributes: object.attributes });
  } catch (error) {
    console.error("Error extracting psychology attributes:", error);
    return NextResponse.json(
      { error: "Failed to extract psychology attributes" },
      { status: 500 },
    );
  }
}
