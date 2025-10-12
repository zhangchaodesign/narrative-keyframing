import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const ConflictSchema = z.object({
  isConflicting: z
    .boolean()
    .describe(
      "True if the new attribute conflicts with any existing attributes",
    ),
  conflictingAttribute: z
    .string()
    .optional()
    .describe("Name of the existing attribute that conflicts"),
  severity: z
    .enum(["high", "medium", "low", "none"])
    .optional()
    .describe("Severity of the conflict"),
  explanation: z
    .string()
    .optional()
    .describe(
      "Brief explanation of why these attributes conflict; or 'none' if no conflict",
    ),
});

export async function POST(request: Request) {
  try {
    const { category, newAttributeName, newEvidence, existingAttributes } =
      await request.json();

    if (!category || !newAttributeName || !newEvidence || !existingAttributes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Build existing attributes summary for context
    const existingSummary = existingAttributes
      .map((attr: { name: string; evidenceCount: number }) => {
        return `- ${attr.name} (${attr.evidenceCount} evidence pieces)`;
      })
      .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ConflictSchema,
      prompt: `You are an expert in detecting inconsistencies in character development and narrative coherence.

Your task is to determine if a newly identified character attribute conflicts with existing attributes.

CONFLICT TYPES:
1. Direct Contradiction: Attributes that cannot coexist
   - Example: "shy" vs "outgoing", "wealthy" vs "poor", "young" vs "elderly"

2. Behavioral Inconsistency: Actions/traits that contradict established patterns
   - Example: "compassionate" character acts cruelly without explanation
   - Example: "illiterate" character quotes Shakespeare

3. Temporal Impossibility: Changes that don't align with story timeline
   - Example: "pregnant" then "not pregnant" in same day
   - Example: "injured" then "athletic performance" immediately after

SEVERITY LEVELS:
- HIGH: Direct contradictions (black/white opposites)
- MEDIUM: Behavioral inconsistencies that seem unnatural
- LOW: Minor tensions that could be explained by character complexity

IMPORTANT:
- Allow for character complexity: People can be both "nervous" and "confident" in different contexts
- Consider evidence context: "acted bravely" doesn't conflict with "generally anxious"
- Flag only genuine inconsistencies, not natural human variability

Category: ${category}
New Attribute: "${newAttributeName}"
New Evidence: "${newEvidence}"

Existing ${category} Attributes:
${existingSummary}

Does the new attribute "${newAttributeName}" conflict with any existing attributes? Consider the evidence context carefully.`,
      temperature: 0.3,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    return NextResponse.json(
      { error: "Failed to detect conflicts" },
      { status: 500 },
    );
  }
}
