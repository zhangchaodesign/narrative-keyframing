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
          content: `You are an expert in literary analysis. Your task is to identify SPEECH indicators for character characterization.

Speech: Dialogue, verbal expressions, or what the character says that reveals their personality, attitudes, or traits (e.g., "I'm so tired of this", "Whatever", "Please, I insist").

This follows the "show, don't tell" principle - characterization through what the character SAYS.

Rules:
1. Only return actual dialogue or speech content (what's inside quotation marks or reported speech)
2. Return the EXACT text as it appears in the sentence
3. Include dialogue tags if they're part of the characterization (e.g., "he muttered")
4. Focus on speech that reveals character traits, not just information
5. Return an empty array if no speech exists

Examples:
- 'John said, "I don\'t care anymore"' → ["I don't care anymore"]
- "She muttered something under her breath" → ["muttered something under her breath"]
- '"Whatever," he replied dismissively' → ["Whatever", "replied dismissively"]
- "John went to the store" → [] (no speech)`,
        },
        {
          role: "user",
          content: `Story context: ${story}

Character: ${characterName}
Sentence: "${sentence}"
Character references in this sentence: ${coreferences.join(", ")}

Find all SPEECH indicators (dialogue or verbal expressions) by ${characterName} in this sentence. Return ONLY the exact text of each speech indicator as a JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const indicators = result.indicators || [];
    console.log(
      "Extracted indicators (speech):",
      indicators,
      characterName,
      sentence,
    );

    return NextResponse.json({ indicators });
  } catch (error) {
    console.error("Error extracting speech:", error);
    return NextResponse.json(
      { error: "Failed to extract speech" },
      { status: 500 },
    );
  }
}
