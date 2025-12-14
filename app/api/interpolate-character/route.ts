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

const NearbySnapshotSchema = z.object({
  name: z.string().min(1),
  traits: TraitListSchema,
  position: z.enum(["before", "after"]),
});

const RequestSchema = z.object({
  perspectiveText: z.string().min(1),
  narratorName: z.string().min(1),
  nearbySnapshots: z.array(NearbySnapshotSchema).default([]),
  eventDescription: z.string().optional(),
});

const ResponseSchema = z.object({
  characterSnapshot: CharacterSnapshotSchema,
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

    const { perspectiveText, narratorName, nearbySnapshots, eventDescription } =
      payload.data;

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

    const eventContext = eventDescription
      ? `\nEvent context: ${eventDescription}`
      : "";

    const prompt = `You are analyzing a character's perspective to extract their traits at this specific moment in the story.

${eventContext}

Perspective narration by ${narratorName}:
"${perspectiveText}"
${snapshotsContext}

Based on the perspective text${
      nearbySnapshots.length > 0 ? " and nearby snapshots" : ""
    }, extract the character traits for ${narratorName} at this moment.

Guidelines:
- Physiology: Physical appearance, clothing, body language, visible characteristics
- Psychology: Emotions, motivations, thoughts, beliefs, mental state
- Sociology: Social roles, relationships, status, interactions with others
${
  nearbySnapshots.length > 0
    ? "- Consider the character's development trajectory from nearby snapshots"
    : ""
}
- Only include traits that are evident or strongly implied in the text
- Keep trait descriptions concise (3-8 words each)
- Return 2-5 traits per category when evident

Return a character snapshot as a JSON object.`;

    console.log("Character interpolation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.characterSnapshot) {
      return NextResponse.json(
        { error: "Failed to generate character snapshot" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error interpolating character snapshot:", error);
    return NextResponse.json(
      { error: "Unable to interpolate character snapshot" },
      { status: 500 },
    );
  }
}
