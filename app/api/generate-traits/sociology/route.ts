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
  storyOutline: z.array(EventSchema).min(1),
  currentEvent: EventSchema,
  characterName: z.string().optional(),
  existingTraits: z.array(z.string().min(1)).optional(),
});

const ResponseSchema = z.object({
  traits: z.array(z.string().min(1)).length(3),
});

const CATEGORY_LABEL = "Sociology";
const CATEGORY_GUIDANCE =
  "Social roles, relationships, status, interactions with others.";

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: payload.error.issues },
        { status: 400 },
      );
    }

    const { storyOutline, currentEvent, characterName, existingTraits } =
      payload.data;

    const outlineText = storyOutline
      .map(
        (event, index) =>
          `${index + 1}. ${event.label}: ${event.description}`,
      )
      .join("\n");

    const existingText = (existingTraits ?? [])
      .map((trait) => trait.trim())
      .filter((trait) => trait.length > 0)
      .join(", ");

    const resolvedCharacterName =
      characterName?.trim().length ? characterName.trim() : "the character";

    const prompt = `You are a story development assistant.

Story outline:
${outlineText}

Current event:
${currentEvent.label}: ${currentEvent.description}

Character: ${resolvedCharacterName}
Existing ${CATEGORY_LABEL.toLowerCase()} traits: ${
      existingText.length > 0 ? existingText : "(none)"
    }

Brainstorm three concise ${CATEGORY_LABEL.toLowerCase()} traits for this moment.

Guidelines:
- Focus on ${CATEGORY_GUIDANCE}
- Keep each trait 3-8 words
- Avoid repeating existing traits or near-duplicates
- Return exactly three traits

Return JSON that matches the provided schema.`;

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
      temperature: 0.7,
    });

    if (!object?.traits || object.traits.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate brainstorm traits" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error brainstorming sociology traits:", error);
    return NextResponse.json(
      { error: "Unable to brainstorm sociology traits" },
      { status: 500 },
    );
  }
}
