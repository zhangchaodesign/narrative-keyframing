import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { story, characters } = await req.json();

    if (!story || !characters || characters.length === 0) {
      return NextResponse.json(
        { error: "Story and characters are required" },
        { status: 400 },
      );
    }

    const prompt = `You are analyzing character relationships in a story.

Story:
${story}

Characters:
${characters.join(", ")}

Analyze the relationships between these characters based ONLY on what is explicitly shown or strongly implied in the story.

For each relationship, provide:
1. source: The first character's name (exactly as provided)
2. target: The second character's name (exactly as provided)
3. type: A descriptive label for the relationship (e.g., "mentor", "rival", "parent", "friend", "sibling", etc.)
4. description: A brief 1-sentence description of their relationship

Rules:
- Only include relationships that are clearly demonstrated in the story
- Do not speculate beyond what the text shows
- Include bidirectional relationships if relevant (e.g., if A is B's friend AND B is also A's friend, include both)
- Use specific, descriptive relationship types that capture the dynamic
- Keep descriptions concise
- Return ONLY valid JSON, no markdown formatting

Return your analysis in this exact JSON format:
{
  "relationships": [
    {
      "source": "Character1",
      "target": "Character2",
      "type": "friend",
      "description": "Brief description of their relationship"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content:
            "You are a literary analysis assistant that identifies character relationships. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error analyzing relationships:", error);
    return NextResponse.json(
      { error: "Failed to analyze relationships" },
      { status: 500 },
    );
  }
}
