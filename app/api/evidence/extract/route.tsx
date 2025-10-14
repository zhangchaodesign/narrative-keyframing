import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const PhraseSchema = z.object({
  text: z.string().describe("Exact verbatim phrase from the sentence"),
});

const indicatorDescriptions = {
  directDefinition:
    "Explicit direct statements or labels about the character (e.g., 'old man', 'tall woman', 'brave soldier', 'brother')",
  actions:
    "Physical actions, behaviors, or body language (e.g., 'moved slowly', 'frowned', 'clenched his fists')",
  speech:
    "What the character says, how they speak, dialogue patterns, inner thoughts, or how other characters say about them (e.g., 'shouted angrily', 'whispered softly')",
  appearance:
    "Visual descriptions of the character (e.g., 'gray hair', 'wrinkled skin', 'piercing blue eyes')",
  environment:
    "Surroundings, context, or setting that characterizes the person (e.g., 'in his mansion', 'wearing rags')",
};

export async function POST(request: Request) {
  try {
    const { story, sentence, characterName, indicatorType } =
      await request.json();

    if (!story || !sentence || !characterName || !indicatorType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const validIndicatorTypes = [
      "directDefinition",
      "actions",
      "speech",
      "appearance",
      "environment",
    ];

    if (!validIndicatorTypes.includes(indicatorType)) {
      return NextResponse.json(
        { error: "Invalid indicator type" },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: z.object({
        phrases: z.array(PhraseSchema),
      }),
      prompt: `You are an expert in literary character analysis. Your task is to extract specific types of characterization evidence from a sentence.

You are looking for: **${indicatorType}** evidence
Definition: ${
        indicatorDescriptions[
          indicatorType as keyof typeof indicatorDescriptions
        ]
      }

Rules:
1. Extract ONLY phrases of type "${indicatorType}" that relate to the character "${characterName}"
2. Each phrase must be EXACT verbatim text from the sentence (exactly as it appears)
3. Extract ALL relevant phrases of this type, not just one
4. Return empty array if no phrases of this type exist
5. DO NOT interpret or infer what the phrases mean - just extract them
6. Phrases should be meaningful units (not single words unless they're standalone)
7. The text must match exactly including spaces, punctuation, and case

Story context (for understanding): ${story}

Sentence to analyze: "${sentence}"
Target character: ${characterName}

Extract all "${indicatorType}" phrases about ${characterName} from this sentence.`,
    });

    // console.log("Extracted evidence phrases:", object.phrases);

    return NextResponse.json({ phrases: object.phrases });
  } catch (error) {
    console.error("Error extracting evidence phrases:", error);
    return NextResponse.json(
      { error: "Failed to extract evidence phrases" },
      { status: 500 },
    );
  }
}
