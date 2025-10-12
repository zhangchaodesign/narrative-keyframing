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
          content: `You are an expert in literary analysis. Your task is to identify ENVIRONMENT indicators for character characterization.

Environment: Descriptions of the character's surroundings, setting, or context that reveal their personality, status, or state (e.g., "cluttered office", "luxurious penthouse", "dark alley", "childhood bedroom").

This follows the "show, don't tell" principle - characterization through the character's ENVIRONMENT and what surrounds them.

Rules:
1. Only return descriptions of settings, places, or surroundings associated with the character
2. Return the EXACT text as it appears in the sentence
3. Focus on environmental details that suggest character traits or circumstances
4. Include both physical locations and atmospheric descriptions
5. Return an empty array if no environmental descriptions exist

Examples:
- "John sat in his cluttered, messy office" → ["cluttered, messy office"]
- "She lived in a luxurious penthouse" → ["luxurious penthouse"]
- "The dark, cramped apartment reflected his mood" → ["dark, cramped apartment"]
- "John walked quickly" → [] (no environment description)`,
        },
        {
          role: "user",
          content: `Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Find all ENVIRONMENT indicators (setting or surroundings descriptions) associated with ${characterName} in this sentence. Return ONLY the exact text of each environment indicator as a JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const indicators = result.indicators || [];
    console.log(
      "Extracted indicators (environment):",
      indicators,
      characterName,
      sentence,
    );

    return NextResponse.json({ indicators });
  } catch (error) {
    console.error("Error extracting environment:", error);
    return NextResponse.json(
      { error: "Failed to extract environment" },
      { status: 500 },
    );
  }
}
