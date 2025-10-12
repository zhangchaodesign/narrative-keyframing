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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert in literary analysis. Your task is to identify ACTION indicators for character characterization.

Actions: Physical actions, behaviors, or activities performed by the character that reveal their personality, state, or traits indirectly (e.g., "tapped his foot", "slammed the door", "smiled warmly").

This follows the "show, don't tell" principle - characterization through what the character DOES.

Rules:
1. Only return verb phrases describing the character's physical actions
2. Return the EXACT text as it appears in the sentence
3. Focus on actions that reveal character traits (not just any movement)
4. Include the verb and its direct objects/modifiers (e.g., "tapped his foot", not just "tapped")
5. Return an empty array if no significant actions exist

Examples:
- "John tapped his foot nervously" → ["tapped his foot"]
- "She slammed the door and stormed out" → ["slammed the door", "stormed out"]
- "He smiled warmly at her" → ["smiled warmly"]
- "John was tall" → [] (not an action)`,
        },
        {
          role: "user",
          content: `Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Find all ACTION indicators (physical actions/behaviors) performed by ${characterName} in this sentence. Return ONLY the exact text of each action phrase as a JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const indicators = result.indicators || [];
    console.log(
      "Extracted indicators (actions):",
      indicators,
      characterName,
      sentence,
    );

    return NextResponse.json({ indicators });
  } catch (error) {
    console.error("Error extracting actions:", error);
    return NextResponse.json(
      { error: "Failed to extract actions" },
      { status: 500 },
    );
  }
}
