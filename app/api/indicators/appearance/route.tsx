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
          content: `You are an expert in literary analysis. Your task is to identify APPEARANCE indicators for character characterization.

Appearance: Physical descriptions, clothing, facial expressions, body language, or visual attributes that reveal the character's personality or state (e.g., "disheveled hair", "worn-out shoes", "tired eyes", "expensive suit").

This follows the "show, don't tell" principle - characterization through HOW the character LOOKS.

Rules:
1. Only return descriptions of physical appearance or visual attributes
2. Return the EXACT text as it appears in the sentence
3. Include descriptive phrases that paint a visual picture
4. Focus on appearance details that suggest character traits or states
5. Return an empty array if no appearance descriptions exist

Examples:
- "John's disheveled hair and wrinkled shirt" → ["disheveled hair", "wrinkled shirt"]
- "She wore an expensive designer suit" → ["expensive designer suit"]
- "His tired eyes betrayed his exhaustion" → ["tired eyes"]
- "John said hello" → [] (no appearance description)`,
        },
        {
          role: "user",
          content: `Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Find all APPEARANCE indicators (physical descriptions or visual attributes) of ${characterName} in this sentence. Return ONLY the exact text of each appearance indicator as a JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const indicators = result.indicators || [];
    console.log(
      "Extracted indicators (appearance):",
      indicators,
      characterName,
      sentence,
    );

    return NextResponse.json({ indicators });
  } catch (error) {
    console.error("Error extracting appearance:", error);
    return NextResponse.json(
      { error: "Failed to extract appearance" },
      { status: 500 },
    );
  }
}
