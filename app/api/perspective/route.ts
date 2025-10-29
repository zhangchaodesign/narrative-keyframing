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
  developmentFocus: z
    .string()
    .describe(
      "Concise note describing the trajectory this snapshot should illuminate (e.g., 'from reckless curiosity to grounded courage').",
    )
    .optional(),
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
  eventSequence: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .optional(),
  perspectives: z.array(PerspectiveTaskSchema).min(1),
});

const PerspectiveResultSchema = z.object({
  reflection: z
    .string()
    .min(1)
    .describe(
      "First-person perspective written by the specified narrator, rooted in the event objective and illustrating the highlighted character development.",
    ),
});

const ResponseSchema = z.object({
  perspectives: z.array(PerspectiveResultSchema),
});

const formatTraitCategory = (label: string, traits: string[]) => {
  if (!traits || traits.length === 0) {
    return `- ${label}: (no specific traits provided)`;
  }
  return `- ${label}: ${traits.join(", ")}`;
};

const buildSnapshotSection = (
  snapshot: z.infer<typeof CharacterSnapshotSchema>,
  index: number,
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

  const developmentNote = snapshot.developmentFocus
    ? `Development focus: ${snapshot.developmentFocus}`
    : null;

  if (traitsAreEmpty && !developmentNote) {
    return header;
  }

  const sectionLines = traitsAreEmpty ? [] : traitLines;
  const trailingNote = developmentNote ? [developmentNote] : [];

  return [header, ...sectionLines, ...trailingNote].join("\n");
};

const buildTasksSection = (tasks: z.infer<typeof PerspectiveTaskSchema>[]) => {
  const snapshotHasDetails = (
    snapshot: z.infer<typeof CharacterSnapshotSchema>,
  ) => {
    const traits = snapshot.traits ?? {
      physiology: [],
      psychology: [],
      sociology: [],
    };

    const hasTraitDetails = (["physiology", "psychology", "sociology"] as const)
      .map((category) => traits[category] ?? [])
      .some((values) => values.some((value) => value.trim().length > 0));

    const hasDevelopmentFocus = Boolean(
      snapshot.developmentFocus?.trim().length,
    );

    return hasTraitDetails || hasDevelopmentFocus;
  };

  type TaskMeta = {
    task: z.infer<typeof PerspectiveTaskSchema>;
    snapshots: z.infer<typeof CharacterSnapshotSchema>[];
  };

  const taskMetaList: TaskMeta[] = tasks.map((task) => {
    const snapshots = task.characterSnapshots.filter(snapshotHasDetails);
    return {
      task,
      snapshots,
    };
  });

  return taskMetaList
    .map((meta, taskIndex) => {
      const { task } = meta;
      const snapshotsForDisplay = meta.snapshots;

      const snapshotSection = snapshotsForDisplay.length
        ? `Character snapshots to embody:
${snapshotsForDisplay
  .map((snapshot, snapshotIndex) =>
    buildSnapshotSection(snapshot, snapshotIndex),
  )
  .join("\n\n")}`
        : "Character snapshots to embody: (none provided)";

      return `Task ${taskIndex + 1}
${task.eventLabel}: ${task.eventObjective}
Narrator: ${task.narrator}
${snapshotSection}`.trim();
    })
    .join("\n\n");
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

    const { eventSequence = [], perspectives } = payload.data;

    const timelineSection =
      eventSequence.length > 0
        ? `Overall event sequence:
${eventSequence
  .map(
    (event, index) =>
      `${index + 1}. ${event.label}: ${event.description.trim()}`,
  )
  .join("\n")}

`
        : "";

    console.log("Generating perspectives for tasks:", perspectives);

    const tasksSection = buildTasksSection(perspectives);

    const prompt = `You are a narrative writer crafting first-person story beats.

${timelineSection}For each task that follows, write a vivid first-person perspective of the assigned event from the perspective of the specified narrator:
- Anchor the scene in the objective event description.
- Use 2-4 sentences rich with sensory or emotional detail.
- If character snapshots are supplied, embody the narrator exactly as those checkpoints describe.
- If no snapshots are supplied for a task, narrate how the narrator moves from the prior snapshot state to the next.
- Keep the progression consistent with previously established facts.

Return each result as a JSON object that satisfies the provided schema.

${tasksSection}`;

    console.log("Perspective generation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.perspectives || object.perspectives.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate perspectives" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating perspective:", error);
    return NextResponse.json(
      { error: "Unable to generate perspectives" },
      { status: 500 },
    );
  }
}
