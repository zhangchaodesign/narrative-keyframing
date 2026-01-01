"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const TraitListSchema = z.object({
  physiology: z.array(z.string().min(1)).default([]),
  psychology: z.array(z.string().min(1)).default([]),
  sociology: z.array(z.string().min(1)).default([]),
});

const CharacterSnapshotSchema = z.object({
  name: z.string().min(1),
  traits: TraitListSchema,
});

const PerspectiveTaskSchema = z
  .object({
    id: z.string().min(1),
    narrator: z.string().min(1),
    eventLabel: z.string().min(1),
    eventObjective: z.string().min(1),
    characterSnapshots: z.array(CharacterSnapshotSchema).default([]),
  })
  .strict();

const RequestSchema = z.object({
  perspective: PerspectiveTaskSchema,
  previousPerspective: z
    .string()
    .describe("Full text of the prior perspective reflection, if any.")
    .optional(),
  nextPerspective: z
    .string()
    .describe("Full text of the following perspective reflection, if any.")
    .optional(),
});

const ResponseSchema = z.object({
  reflection: z
    .string()
    .min(1)
    .describe(
      "First-person perspective written by the specified narrator, rooted in the event objective and illustrating the highlighted character development.",
    ),
});

const formatTraitCategory = (label: string, traits: string[]) => {
  if (!traits || traits.length === 0) {
    return `- ${label}: (no specific traits provided)`;
  }
  return `- ${label}: ${traits.join(", ")}`;
};

const buildSnapshotSection = (
  snapshot: z.infer<typeof CharacterSnapshotSchema>,
) => {
  const header = `Snapshot of ${snapshot.name}`;

  const traits = snapshot.traits ?? {
    physiology: [],
    psychology: [],
    sociology: [],
  };

  const traitsAreEmpty =
    traits.physiology.length === 0 &&
    traits.psychology.length === 0 &&
    traits.sociology.length === 0;

  const traitLines = [
    formatTraitCategory("Physiology", traits.physiology),
    formatTraitCategory("Psychology", traits.psychology),
    formatTraitCategory("Sociology", traits.sociology),
  ];

  if (traitsAreEmpty) {
    return header;
  }

  const sectionLines = traitsAreEmpty ? [] : traitLines;

  return [header, ...sectionLines].join("\n");
};

const buildTaskSection = (task: z.infer<typeof PerspectiveTaskSchema>) => {
  const snapshotsForDisplay = task.characterSnapshots ?? [];

  const snapshotSection = snapshotsForDisplay.length
    ? `Character snapshots to embody:
${snapshotsForDisplay
  .map((snapshot) => buildSnapshotSection(snapshot))
  .join("\n\n")}`
    : "Character snapshots to embody: (none provided)";

  return `Objective: ${task.eventObjective}
Narrator: ${task.narrator}
${snapshotSection}`.trim();
};

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const { perspective, previousPerspective, nextPerspective } = payload.data;

    const adjacentSections: string[] = [];
    if (previousPerspective && previousPerspective.trim().length > 0) {
      adjacentSections.push(`Previous text:\n${previousPerspective.trim()}`);
    }
    if (nextPerspective && nextPerspective.trim().length > 0) {
      adjacentSections.push(`Next text:\n${nextPerspective.trim()}`);
    }
    const adjacencyContext = adjacentSections.length
      ? `Adjacent text for continuity:\n${adjacentSections.join("\n\n")}\n\n`
      : "";

    const taskSection = buildTaskSection(perspective);

    const prompt = `You are a narrative writer crafting a first-person story beat.

${adjacencyContext}Write a vivid first-person perspective of the assigned event from the perspective of the specified narrator:
- Anchor the scene in the objective event description.
- Use 2-4 sentences rich with sensory or emotional detail.
- Embody the narrator exactly as the provided character snapshot describes.
- Keep the progression consistent with previously established facts.
- Make sure to cover all character attributes provided in the snapshots throughout the narration.

Task details:
${taskSection}

Return the result as a JSON object that satisfies the provided schema.`;

    console.log("Single perspective generation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.reflection) {
      return NextResponse.json(
        { error: "Failed to generate perspective" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating single perspective:", error);
    return NextResponse.json(
      { error: "Unable to regenerate perspective" },
      { status: 500 },
    );
  }
}
