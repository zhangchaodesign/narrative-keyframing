"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const TraitCategorySchema = z.enum(["physiology", "psychology", "sociology"]);

const TraitListSchema = z.object({
  physiology: z.array(z.string().min(1)).default([]),
  psychology: z.array(z.string().min(1)).default([]),
  sociology: z.array(z.string().min(1)).default([]),
});

const CharacterSnapshotSchema = z.object({
  name: z.string().min(1),
  stageLabel: z.string().optional(),
  traits: TraitListSchema,
  developmentFocus: z
    .string()
    .describe(
      "Concise note describing the trajectory this snapshot should illuminate (e.g., 'from reckless curiosity to grounded courage').",
    )
    .optional(),
});

const TraitTransitionSchema = z.object({
  fromCharacter: z.string().min(1),
  toCharacter: z.string().min(1),
  category: TraitCategorySchema,
  fromTrait: z.string().trim().optional(),
  toTrait: z.string().trim().optional(),
});

const NarrationTaskSchema = z
  .object({
    id: z.string().min(1),
    narrator: z.string().min(1),
    eventLabel: z.string().min(1),
    eventObjective: z.string().min(1),
    characterSnapshots: z.array(CharacterSnapshotSchema).optional(),
    traitTransitions: z.array(TraitTransitionSchema).optional(),
  })
  .refine(
    (task) =>
      (task.characterSnapshots && task.characterSnapshots.length > 0) ||
      (task.traitTransitions && task.traitTransitions.length > 0),
    {
      message:
        "Each narration task must include character snapshots, trait transitions, or both.",
    },
  );

const RequestSchema = z.object({
  eventSequence: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .optional(),
  narrations: z.array(NarrationTaskSchema).min(1),
});

const NarrationResultSchema = z.object({
  id: z.string().min(1),
  reflection: z
    .string()
    .min(1)
    .describe(
      "First-person narration written by the specified narrator, rooted in the event objective and illustrating the highlighted character development.",
    ),
});

const ResponseSchema = z.object({
  narrations: z.array(NarrationResultSchema),
});

const CATEGORY_LABELS: Record<z.infer<typeof TraitCategorySchema>, string> = {
  physiology: "Physiology",
  psychology: "Psychology",
  sociology: "Sociology",
};

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
  const stageLabel =
    snapshot.stageLabel?.trim() || `Stage ${index + 1}: ${snapshot.name}`;

  const traits = snapshot.traits ?? {
    physiology: [],
    psychology: [],
    sociology: [],
  };

  const traitLines = [
    formatTraitCategory("Physiology", traits.physiology),
    formatTraitCategory("Psychology", traits.psychology),
    formatTraitCategory("Sociology", traits.sociology),
  ];

  const developmentNote = snapshot.developmentFocus
    ? `Development focus: ${snapshot.developmentFocus}`
    : null;

  return `${stageLabel}
${traitLines.join("\n")}${developmentNote ? `\n${developmentNote}` : ""}`;
};

const formatTraitValue = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "(unspecified)";
};

const buildTransitionSection = (
  transition: z.infer<typeof TraitTransitionSchema>,
  index: number,
) => {
  const categoryLabel = CATEGORY_LABELS[transition.category];
  const beforeLabel = `${transition.fromCharacter} — ${formatTraitValue(
    transition.fromTrait,
  )}`;
  const afterLabel = `${transition.toCharacter} — ${formatTraitValue(
    transition.toTrait,
  )}`;

  return `Transition ${index + 1} (${categoryLabel}):
  From ${beforeLabel}
  To ${afterLabel}`;
};

const buildTasksSection = (tasks: z.infer<typeof NarrationTaskSchema>[]) => {
  type TaskMeta = {
    task: z.infer<typeof NarrationTaskSchema>;
    hasSnapshots: boolean;
    hasTransitions: boolean;
    prevCheckpointIndex: number | null;
    nextCheckpointIndex: number | null;
    checkpointOrdinal: number | null;
  };

  const taskMetaList: TaskMeta[] = tasks.map((task) => ({
    task,
    hasSnapshots: Boolean(task.characterSnapshots?.length),
    hasTransitions: Boolean(task.traitTransitions?.length),
    prevCheckpointIndex: null,
    nextCheckpointIndex: null,
    checkpointOrdinal: null,
  }));

  let checkpointOrdinalCounter = 0;
  taskMetaList.forEach((meta) => {
    if (!meta.hasSnapshots) {
      return;
    }
    meta.checkpointOrdinal = checkpointOrdinalCounter;
    checkpointOrdinalCounter += 1;
  });

  let lastCheckpointIndex: number | null = null;
  taskMetaList.forEach((meta, index) => {
    if (meta.hasSnapshots) {
      lastCheckpointIndex = index;
      return;
    }
    meta.prevCheckpointIndex = lastCheckpointIndex;
  });

  lastCheckpointIndex = null;
  for (let index = taskMetaList.length - 1; index >= 0; index -= 1) {
    const meta = taskMetaList[index]!;
    if (meta.hasSnapshots) {
      lastCheckpointIndex = index;
      continue;
    }
    meta.nextCheckpointIndex = lastCheckpointIndex;
  }

  const sanitizeCheckpointLabel = (label?: string | null) => {
    if (!label) {
      return null;
    }
    const stripped = label.replace(/^Checkpoint\s+\d+:\s*/i, "").trim();
    return stripped.length > 0 ? stripped : null;
  };

  const getSnapshotDescriptor = (
    snapshot: z.infer<typeof CharacterSnapshotSchema>,
  ) => {
    return (
      sanitizeCheckpointLabel(snapshot.stageLabel) ||
      snapshot.name?.trim() ||
      null
    );
  };

  const buildCheckpointLabel = (meta: TaskMeta, index: number) => {
    const ordinalLabel =
      meta.checkpointOrdinal != null
        ? `Checkpoint ${meta.checkpointOrdinal + 1}`
        : `Task ${index + 1}`;

    const snapshots = meta.task.characterSnapshots ?? [];
    if (snapshots.length === 0) {
      return ordinalLabel;
    }

    const descriptors = snapshots
      .map((snapshot) => getSnapshotDescriptor(snapshot))
      .filter((value): value is string => Boolean(value));

    if (descriptors.length === 0) {
      return ordinalLabel;
    }

    return `${ordinalLabel}: ${descriptors.join(" / ")}`;
  };

  const summarizeCheckpoint = (
    checkpointIndex: number | null,
    direction: "prev" | "next",
  ) => {
    if (checkpointIndex == null) {
      return direction === "prev"
        ? "the previous checkpoint state"
        : "the next checkpoint state";
    }

    const checkpointMeta = taskMetaList[checkpointIndex];
    if (!checkpointMeta) {
      return direction === "prev"
        ? "the previous checkpoint state"
        : "the next checkpoint state";
    }

    return buildCheckpointLabel(checkpointMeta, checkpointIndex);
  };

  const sequenceInfo = new Map<
    number,
    {
      position: number;
      length: number;
      prevSummary: string;
      nextSummary: string;
    }
  >();

  let currentSequence: number[] = [];
  const finalizeSequence = () => {
    if (currentSequence.length <= 1) {
      currentSequence = [];
      return;
    }

    const firstTaskIndex = currentSequence[0]!;
    const firstMeta = taskMetaList[firstTaskIndex]!;
    const prevSummary = summarizeCheckpoint(
      firstMeta.prevCheckpointIndex,
      "prev",
    );
    const nextSummary = summarizeCheckpoint(
      firstMeta.nextCheckpointIndex,
      "next",
    );

    currentSequence.forEach((taskIndex, sequenceOffset) => {
      sequenceInfo.set(taskIndex, {
        position: sequenceOffset + 1,
        length: currentSequence.length,
        prevSummary,
        nextSummary,
      });
    });

    currentSequence = [];
  };

  taskMetaList.forEach((meta, index) => {
    const isBetweenCheckpoints =
      !meta.hasSnapshots &&
      meta.hasTransitions &&
      meta.prevCheckpointIndex != null &&
      meta.nextCheckpointIndex != null;

    if (isBetweenCheckpoints) {
      currentSequence.push(index);
      return;
    }

    finalizeSequence();
  });
  finalizeSequence();

  return taskMetaList
    .map((meta, taskIndex) => {
      const { task } = meta;

      const snapshotsForDisplay =
        meta.hasSnapshots && task.characterSnapshots
          ? task.characterSnapshots.length === 1 &&
            meta.checkpointOrdinal != null
            ? task.characterSnapshots.map((snapshot) => {
                const ordinalIndex = meta.checkpointOrdinal ?? 0;
                const descriptor = getSnapshotDescriptor(snapshot);
                const stageLabel = descriptor
                  ? `Checkpoint ${ordinalIndex + 1}: ${descriptor}`
                  : `Checkpoint ${ordinalIndex + 1}`;
                return {
                  ...snapshot,
                  stageLabel,
                };
              })
            : task.characterSnapshots
          : null;

      const snapshotSection = snapshotsForDisplay?.length
        ? `Character snapshots to embody:
${snapshotsForDisplay
  .map((snapshot, snapshotIndex) =>
    buildSnapshotSection(snapshot, snapshotIndex),
  )
  .join("\n\n")}`
        : null;

      const transitionsSection = task.traitTransitions?.length
        ? `Trait transitions to express:
${task.traitTransitions
  .map((transition, transitionIndex) =>
    buildTransitionSection(transition, transitionIndex),
  )
  .join("\n")}`
        : null;

      const coordinationMetadata = sequenceInfo.get(taskIndex);
      const transitionCoordinationSection = coordinationMetadata
        ? `Transition coordination:
This is transition beat ${coordinationMetadata.position} of ${coordinationMetadata.length} that bridges ${coordinationMetadata.prevSummary} to ${coordinationMetadata.nextSummary}. Build on the earlier beats, highlight a distinct facet of the shift, and avoid repeating or undoing progress in the listed transitions.`
        : null;

      const guidanceBlocks = [
        snapshotSection,
        transitionsSection,
        transitionCoordinationSection,
      ]
        .filter((section): section is string => Boolean(section))
        .join("\n\n");

      return `Task ${taskIndex + 1}
Event: ${task.eventLabel} — ${task.eventObjective}
Narrator: ${task.narrator}
${guidanceBlocks}`.trim();
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

    const { eventSequence = [], narrations } = payload.data;

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

    const tasksSection = buildTasksSection(narrations);

    const prompt = `You are a narrative writer crafting first-person story beats.

${timelineSection}For each task that follows, write a vivid first-person narration of the assigned event from the perspective of the specified narrator:
- Anchor the scene in the objective event description.
- Use 2-4 sentences rich with sensory or emotional detail.
- If character snapshots are supplied, embody the narrator exactly as those checkpoints describe.
- If trait transitions are supplied, portray how the narrator shifts from the "from" traits to the "to" traits within the moment.
- When several transition-only tasks appear consecutively between checkpoints, treat them as sequential beats of one transformation: progress the change together, avoid repeating identical beats, and never revert to traits that have already shifted.
- Keep the progression consistent with previously established facts.

Return each result as a JSON object that satisfies the provided schema.

${tasksSection}`;

    console.log("Narration generation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.narrations || object.narrations.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate narrations" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating narration:", error);
    return NextResponse.json(
      { error: "Unable to generate narrations" },
      { status: 500 },
    );
  }
}
