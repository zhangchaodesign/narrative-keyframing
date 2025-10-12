import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { story, characterName, sentence, coreferences } =
      await request.json();

    if (!story || !characterName || !sentence || !coreferences) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in literary analysis. Your task is to identify DIRECT DEFINITION indicators for character traits.

Direct Definition: Words or phrases that EXPLICITLY mention character traits or states (e.g., "nervous", "angry", "intelligent", "stressed").

Rules:
1. Only return words/phrases that DIRECTLY state traits or emotional states
2. Return the EXACT text as it appears in the sentence
3. Do NOT return actions, dialogue, or descriptions - only explicit trait words
4. Return an empty array if no direct definitions exist
5. Focus on adjectives and adverbs that describe the character's traits

Examples:
- "John nervously tapped his foot" → ["nervously"]
- "She was intelligent and kind" → ["intelligent", "kind"]
- "He seemed angry" → ["angry"]
- "John tapped his foot" → [] (no explicit trait)`,
        },
        {
          role: "user",
          content: `Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Find all DIRECT DEFINITION indicators (explicit trait words) for ${characterName} in this sentence. Return ONLY the exact text of each indicator as a JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const indicators = result.indicators || [];
    console.log(
      "Extracted indicators (directDefinition):",
      indicators,
      characterName,
      sentence,
    );

    return NextResponse.json({ indicators });
  } catch (error) {
    console.error("Error extracting direct definitions:", error);
    return NextResponse.json(
      { error: "Failed to extract direct definitions" },
      { status: 500 },
    );
  }
}
