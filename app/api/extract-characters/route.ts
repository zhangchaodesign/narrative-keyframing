"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

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

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/extract-characters/extract_characters.yaml",
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
  data: { eventsSection: string },
) =>
  template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "events_section":
        return data.eventsSection;
      default:
        return match;
    }
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

    const eventsSection = events
      .map((event) => `${event.label}: ${event.description}`)
      .join("\n\n");

    const template = await loadPromptTemplate(TEMPLATE_PATH);
    const prompt = renderPromptTemplate(template, { eventsSection });

    const result = await generateObject({
      model: openai("gpt-5.3-chat-latest"),
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
