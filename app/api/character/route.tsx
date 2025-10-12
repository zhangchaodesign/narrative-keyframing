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
    model: openai("gpt-4.1"),
    schema: z.object({
      characters: z.string(),
    }),
    prompt: `Extract a list of characters from the following story:\n\n${story}`,
  });

  if (!object || !object.characters) {
    return NextResponse.json(
      { error: "Failed to extract characters" },
      { status: 500 },
    );
  }

  return NextResponse.json({ characters: object.characters });
}
