import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { story } = await req.json();
  console.log("Received story:", story);

  if (!story) {
    return NextResponse.json({ error: "Story is required" }, { status: 400 });
  }

  // Extract characters from the story using the AI model
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      characters: z.array(z.string()),
    }),
    prompt: `Extract a list of character names from the following story. Return only the names as an array of strings.

Story:
${story}

Instructions:
1. Return only main character names (first names or full names)
2. Do not include descriptions or titles
3. Return as an array of strings
4. Example: ["John", "Mary", "Dr. Smith"]`,
  });

  if (!object || !object.characters) {
    return NextResponse.json(
      { error: "Failed to extract characters" },
      { status: 500 },
    );
  }

  return NextResponse.json({ characters: object.characters });
}
