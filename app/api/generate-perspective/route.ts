"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

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
  eventSequence: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .optional(),
  perspectives: z.array(PerspectiveTaskSchema).min(1),
  customPrompt: z.string().optional(),
});

const PerspectiveResultSchema = z.object({
  reflection: z.string().min(1),
});

const ResponseSchema = z.object({
  perspectives: z.array(PerspectiveResultSchema),
});

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/generate-perspective/generate_perspective.yaml",
);

const stripTemplateIndent = (text: string) => {
  const lines = text.split("\n");
  const hasIndent = lines.every(
    (line) => line.trim().length === 0 || line.startsWith("  "),
  );
  if (!hasIndent) {
    return text;
  }
  return lines
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n");
};

const loadPromptTemplate = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  const match = raw.match(/template:\s*\|\n([\s\S]*)/);
  if (!match) {
    throw new Error(`Prompt template missing in ${filePath}`);
  }
  const template = stripTemplateIndent(match[1]);
  return template.trimEnd();
};

const renderPromptTemplate = (
  template: string,
  data: {
    baselineStoryText: string;
    baselineActText: string;
    tasksSection: string;
  },
) =>
  template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "baseline_story_text":
        return data.baselineStoryText;
      case "baseline_act_text":
        return data.baselineActText;
      case "tasks_section":
        return data.tasksSection;
      default:
        return match;
    }
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
    return "(no specific traits provided)";
  }

  return traitLines.join("\n");
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

    return hasTraitDetails;
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
        ? `Character traits:
${snapshotsForDisplay
  .map((snapshot, snapshotIndex) =>
    buildSnapshotSection(snapshot, snapshotIndex),
  )
  .join("\n\n")}`
        : "Character traits: (none provided)";

      return `Narrator: ${task.narrator}
${snapshotSection}`.trim();
    })
    .join("\n\n");
};

const buildStoryOutlineText = (
  eventSequence: z.infer<typeof RequestSchema>["eventSequence"],
) => {
  if (!eventSequence || eventSequence.length === 0) {
    return "No story draft provided.";
  }
  return eventSequence
    .map((event, index) => `${event.description.trim()}`)
    .join("\n\n");
};

const buildActText = (tasks: z.infer<typeof PerspectiveTaskSchema>[]) => {
  if (tasks.length === 1) {
    const task = tasks[0];
    if (!task) {
      return "No plot provided.";
    }
    return `${task.eventObjective}`;
  }

  return tasks
    .map(
      (task, index) =>
        `${index + 1}. ${task.eventLabel}: ${task.eventObjective}`,
    )
    .join("\n");
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

    const { eventSequence = [], perspectives, customPrompt } = payload.data;

    const tasksSection = buildTasksSection(perspectives);
    const baselineStoryText = buildStoryOutlineText(eventSequence);
    const baselineActText = buildActText(perspectives);

    const template = await loadPromptTemplate(TEMPLATE_PATH);
    const basePrompt = renderPromptTemplate(template, {
      baselineStoryText,
      baselineActText,
      tasksSection,
    });

    const trimmedPrompt = customPrompt?.trim();
    const prompt = trimmedPrompt
      ? `${basePrompt}

ADDITIONAL INSTRUCTIONS FROM USER:
${trimmedPrompt}`
      : basePrompt;

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
