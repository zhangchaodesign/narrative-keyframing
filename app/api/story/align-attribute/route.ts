import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const EvidenceSchema = z.object({
  text: z.string(),
  indicatorType: z.string().optional(),
});

const EvidenceSentenceSchema = z.object({
  sentenceIndex: z.number(),
  sentenceText: z.string(),
  evidence: z.array(EvidenceSchema),
});

const BodySchema = z.object({
  story: z.string(),
  characterName: z.string(),
  attributeCategory: z.string(),
  oldAttributeName: z.string(),
  newAttributeName: z.string(),
  evidenceSentences: z.array(EvidenceSentenceSchema),
});

const AlignmentResponseSchema = z.object({
  updates: z
    .array(
      z.object({
        sentenceIndex: z.number(),
        revisedSentence: z
          .string()
          .describe("Sentence rewritten to match the new attribute"),
        updatedEvidence: z
          .array(
            z
              .object({
                text: z.string().describe("Verbatim evidence phrase that supports the attribute"),
              })
              .passthrough(),
          )
          .default([]),
        rationale: z
          .string()
          .optional()
          .describe("Optional short note describing the change"),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = BodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const {
      story,
      characterName,
      attributeCategory,
      oldAttributeName,
      newAttributeName,
      evidenceSentences,
    } = parsed.data;

    if (evidenceSentences.length === 0) {
      return NextResponse.json(
        { error: "No evidence sentences provided for alignment." },
        { status: 400 },
      );
    }

    const evidenceSummary = evidenceSentences
      .map((entry, index) => {
        const evidenceLines = entry.evidence
          .map(
            (evidence, evidenceIndex) =>
              `  ${evidenceIndex + 1}. "${evidence.text}" (indicator: ${
                evidence.indicatorType ?? "unspecified"
              })`,
          )
          .join("\n");
        return `Sentence ${index + 1} (index ${entry.sentenceIndex}):
Original: "${entry.sentenceText.trim()}"
Evidence phrases:
${evidenceLines || "  (none listed)"}`;
      })
      .join("\n\n");

    const prompt = `You are a skilled fiction line-editor. A character attribute has been renamed and the supporting sentences must reflect the new attribute without breaking the story.

Story:
"""
${story}
"""

Character: ${characterName}
Attribute category: ${attributeCategory}
Previous attribute name: ${oldAttributeName}
New attribute name: ${newAttributeName}

Target sentences tied to the attribute:
${evidenceSummary}

For each sentence, rewrite it so it consistently reflects the NEW attribute while preserving the existing plot, continuity, tone, tense, point of view, and relationships. Do not create new contradictions or add new facts unrelated to the attribute change. Each output must remain a single sentence.

For every sentence you rewrite, also return the updated evidence phrases that best support the attribute. The evidence list must have the SAME number of entries and the SAME order as the phrases provided for that sentence. Each evidence entry should contain the verbatim text that appears in your revised sentence, so the caller can relink it to the attribute.

Return only JSON that matches the provided schema.`;

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: AlignmentResponseSchema,
      prompt,
    });

    return NextResponse.json(
      {
        updates: object.updates ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to align story with updated attribute:", error);
    return NextResponse.json(
      { error: "Failed to align story with the updated attribute." },
      { status: 500 },
    );
  }
}
