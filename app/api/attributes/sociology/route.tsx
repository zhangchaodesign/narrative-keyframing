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
      "The attribute name (e.g., 'wealthy', 'educated', 'working-class', 'professional')",
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

Your task is to identify SOCIOLOGY attributes for a character from a sentence.

SOCIOLOGY Category includes:
- Social class and economic status (wealthy, poor, middle-class, etc.)
- Education level (educated, scholarly, uneducated, etc.)
- Occupation and professional status
- Social background and upbringing
- Cultural and ethnic background
- Community and social connections
- Social roles and relationships

For each sociology attribute you identify:
1. Infer the attribute name (e.g., "wealthy", "educated", "working-class", "professional")
2. Find ALL verbatim evidence from the sentence that supports this attribute
3. Categorize each piece of evidence by indicator type:
   - directDefinition: Explicit statements (e.g., "wealthy businessman", "college graduate")
   - actions: Behaviors revealing social status (e.g., "ordered expensive wine")
   - speech: Language/dialect revealing background (e.g., formal speech, slang)
   - appearance: Clothing/accessories suggesting status (e.g., "designer suit", "worn shoes")
   - environment: Settings revealing social context (e.g., "penthouse office", "small apartment")

Rules:
- Only return attributes you can clearly infer from the sentence
- Evidence must be EXACT verbatim text from the sentence
- Each evidence piece must have exactly one indicator type
- Return empty array if no sociology attributes can be inferred
- Focus on the target character, not others in the sentence

Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Analyze this sentence and identify all SOCIOLOGY attributes for ${characterName}. For each attribute, provide the attribute name and all verbatim evidence with indicator types.`,
      temperature: 0.3,
    });

    return NextResponse.json({ attributes: object.attributes });
  } catch (error) {
    console.error("Error extracting sociology attributes:", error);
    return NextResponse.json(
      { error: "Failed to extract sociology attributes" },
      { status: 500 },
    );
  }
}
