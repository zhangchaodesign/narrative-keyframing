import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const SentenceConflictSchema = z.object({
  conflicts: z
    .array(
      z.object({
        attributeName: z
          .string()
          .describe("Name of the existing attribute that conflicts"),
        attributeCategory: z
          .enum(["physiology", "psychology", "sociology"])
          .describe("Category of the conflicting attribute"),
        conflictingEvidence: z
          .string()
          .describe(
            "The specific text from the new sentence that contradicts the attribute",
          ),
        severity: z
          .enum(["high", "medium", "low", "none"])
          .describe("Severity of the conflict"),
        explanation: z
          .string()
          .describe(
            "Brief explanation of why this sentence conflicts; empty if none",
          ),
      }),
    )
    .describe("List of conflicts found in this sentence"),
});

export async function POST(request: Request) {
  try {
    const { characterName, sentence, existingAttributes } =
      await request.json();

    if (!characterName || !sentence || !existingAttributes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // console.log("Detecting sentence conflicts for:", {
    //   characterName,
    //   sentence: sentence.substring(0, 100),
    //   attributeCount: existingAttributes.length,
    // });

    // Build existing attributes summary organized by category
    const attributesByCategory = {
      physiology: [] as string[],
      psychology: [] as string[],
      sociology: [] as string[],
    };

    existingAttributes.forEach(
      (attr: { name: string; category: string; evidenceCount: number }) => {
        const category = attr.category as keyof typeof attributesByCategory;
        attributesByCategory[category].push(
          `- ${attr.name} (${attr.evidenceCount} evidence pieces)`,
        );
      },
    );

    const attributesSummary = `
PHYSIOLOGY (physical traits):
${
  attributesByCategory.physiology.length > 0
    ? attributesByCategory.physiology.join("\n")
    : "- None established"
}

PSYCHOLOGY (personality, mindset):
${
  attributesByCategory.psychology.length > 0
    ? attributesByCategory.psychology.join("\n")
    : "- None established"
}

SOCIOLOGY (relationships, social status):
${
  attributesByCategory.sociology.length > 0
    ? attributesByCategory.sociology.join("\n")
    : "- None established"
}
`.trim();

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: SentenceConflictSchema,
      prompt: `You are an expert in detecting narrative inconsistencies and character development contradictions.

Your task: Analyze a NEW SENTENCE to see if it contains any evidence that CONTRADICTS existing established character attributes.

IMPORTANT DISTINCTION:
- DO NOT identify new attributes in the sentence
- DO NOT compare new attributes with old attributes
- ONLY identify if the sentence content contradicts what we already know about the character

CONFLICT TYPES:
1. Direct Contradiction: Sentence states something opposite to established attribute
   - Example: Established "blonde hair" → Sentence: "brushed his dark hair"
   - Example: Established "outgoing" → Sentence: "avoided all social interaction"

2. Behavioral Contradiction: Action/statement incompatible with established trait
   - Example: Established "illiterate" → Sentence: "read the book fluently"
   - Example: Established "compassionate" → Sentence: "laughed at the suffering child"

3. Temporal Contradiction: Change that doesn't fit timeline
   - Example: Established "pregnant" → Sentence: "went mountain climbing the same day"
   - Example: Established "broken leg" → Sentence: "ran a marathon hours later"

SEVERITY LEVELS:
- HIGH: Clear, direct contradiction (impossible to reconcile)
- MEDIUM: Strong inconsistency (requires explanation)
- LOW: Minor tension (could be explained by context)

WHAT TO IGNORE:
- Natural complexity: "nervous" person can act "bravely" in crisis
- Contextual variation: "quiet" person can be "loud" when angry
- Character growth: Traits can evolve naturally over time
- Situational behavior: Different contexts warrant different responses

CHARACTER: ${characterName}

NEW SENTENCE TO ANALYZE:
"${sentence}"

EXISTING ESTABLISHED ATTRIBUTES:
${attributesSummary}

Identify ANY parts of the new sentence that contradict the established attributes. Return empty array if no conflicts.`,
    });

    // console.log(
    //   "Sentence conflict detection result:",
    //   attributesSummary,
    //   object,
    // );

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error detecting sentence conflicts:", error);
    return NextResponse.json(
      { error: "Failed to detect sentence conflicts" },
      { status: 500 },
    );
  }
}
