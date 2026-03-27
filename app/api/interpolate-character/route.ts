"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const TraitCategoryEnum = z.enum(["physiology", "psychology", "sociology"]);

const TraitListSchema = z.object({
  physiology: z.array(z.string().min(1)).default([]),
  psychology: z.array(z.string().min(1)).default([]),
  sociology: z.array(z.string().min(1)).default([]),
});

const CharacterSnapshotSchema = z.object({
  name: z.string().min(1),
  traits: TraitListSchema,
});

const NearbySnapshotSchema = z.object({
  name: z.string().min(1),
  traits: TraitListSchema,
  position: z.enum(["before", "after"]),
});

const TraitEvidenceSchema = z.object({
  traitCategory: TraitCategoryEnum,
  trait: z.string().min(1),
  evidenceText: z
    .string()
    .min(1)
    .describe("Exact excerpt copied from the perspective narration."),
});

const RequestSchema = z.object({
  perspectiveText: z.string().min(1),
  fullPerspectiveText: z.string().optional(),
  narratorName: z.string().min(1),
  nearbySnapshots: z.array(NearbySnapshotSchema).default([]),
  eventDescription: z.string().optional(),
});

const ResponseSchema = z.object({
  characterSnapshot: CharacterSnapshotSchema,
  traitEvidence: z.array(TraitEvidenceSchema).default([]),
});

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/interpolate-character/interpolate_character.yaml",
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
    narratorName: string;
    perspectiveText: string;
    snapshotsSection: string;
    contextSection: string;
    nearbySnapshotsNote: string;
    nearbySnapshotsGuidance: string;
  },
) =>
  template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "narrator_name":
        return data.narratorName;
      case "perspective_text":
        return data.perspectiveText;
      case "snapshots_section":
        return data.snapshotsSection;
      case "context_section":
        return data.contextSection;
      case "nearby_snapshots_note":
        return data.nearbySnapshotsNote;
      case "nearby_snapshots_guidance":
        return data.nearbySnapshotsGuidance;
      default:
        return match;
    }
  });

const formatTraits = (traits: z.infer<typeof TraitListSchema>) => {
  const lines = [];
  if (traits.physiology.length > 0) {
    lines.push(`  Physiology: ${traits.physiology.join(", ")}`);
  }
  if (traits.psychology.length > 0) {
    lines.push(`  Psychology: ${traits.psychology.join(", ")}`);
  }
  if (traits.sociology.length > 0) {
    lines.push(`  Sociology: ${traits.sociology.join(", ")}`);
  }
  return lines.join("\n");
};

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: payload.error.issues },
        { status: 400 },
      );
    }

    const {
      perspectiveText,
      fullPerspectiveText,
      narratorName,
      nearbySnapshots,
      eventDescription,
    } = payload.data;

    // Build context from nearby snapshots
    const snapshotsContext =
      nearbySnapshots.length > 0
        ? `
Character snapshots from nearby perspectives:
${nearbySnapshots
  .map((snapshot) => {
    const position = snapshot.position === "before" ? "Previous" : "Following";
    return `${position} snapshot of ${snapshot.name}:
${formatTraits(snapshot.traits)}`;
  })
  .join("\n\n")}`
        : "";

    // const eventContext = eventDescription
    //   ? `\nEvent context: ${eventDescription}`
    //   : "";

    const perspectiveContext =
      fullPerspectiveText && fullPerspectiveText.trim().length > 0
        ? `\nFull narration (context only — do NOT quote from this section):\n<<<\n${fullPerspectiveText}\n>>>`
        : "";

    const template = await loadPromptTemplate(TEMPLATE_PATH);
    const prompt = renderPromptTemplate(template, {
      narratorName,
      perspectiveText,
      snapshotsSection: snapshotsContext,
      contextSection: perspectiveContext,
      nearbySnapshotsNote:
        nearbySnapshots.length > 0 ? " and nearby snapshots" : "",
      nearbySnapshotsGuidance:
        nearbySnapshots.length > 0
          ? "- Consider the character's development trajectory from nearby snapshots"
          : "",
    });

    console.log("Character interpolation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.characterSnapshot) {
      return NextResponse.json(
        { error: "Failed to generate character keyframe" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error interpolating character keyframe:", error);
    return NextResponse.json(
      { error: "Unable to interpolate character keyframe" },
      { status: 500 },
    );
  }
}
