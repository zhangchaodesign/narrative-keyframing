"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const EventSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
});

const RequestSchema = z.object({
  events: z.array(EventSchema).min(1),
});

const CharacterSchema = z.object({
  name: z.string().min(1).describe("The character's name"),
  role: z
    .string()
    .describe(
      "Brief description of the character's role in the story (e.g., 'protagonist', 'antagonist', 'mentor', 'supporting character')",
    ),
});

const ResponseSchema = z.object({
  characters: z.array(CharacterSchema),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request format", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { events } = parsed.data;

    const eventDescriptions = events
      .map((event, index) => `${event.label}: ${event.description}`)
      .join("\n\n");

    const prompt = `You are a story analysis assistant. Extract all characters mentioned in the following story outline events. Include main characters, supporting characters, and any named individuals who play a role in the story.

Story Outline:
${eventDescriptions}

For each character, identify:
1. Their name (as mentioned in the outline)
2. Their role in the story (protagonist, antagonist, mentor, supporting character, etc.)

Only include characters that are explicitly mentioned or clearly implied in the outline. Do not invent characters that aren't present.`;

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: ResponseSchema,
      prompt,
      temperature: 0.3,
    });

    return NextResponse.json({
      characters: result.object.characters,
    });
  } catch (error) {
    console.error("Character extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract characters",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
