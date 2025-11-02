"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const SnippetSchema = z.object({
  perspectiveNodeId: z.string().min(1),
  text: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  attributes: z.array(z.string()),
});

const EventDataSchema = z.object({
  narrativeNodeId: z.string().min(1),
  eventId: z.string().optional(),
  eventDescription: z.string().optional(),
  eventTimeline: z.string().optional(),
  snippets: z.array(SnippetSchema).default([]),
});

const RequestSchema = z.object({
  events: z.array(EventDataSchema).min(1),
});

const SnippetUsageSchema = z.object({
  originalSnippet: z.string().describe("The original character detail/snippet text"),
  verbatimInNarrative: z.string().describe("The exact verbatim text in the narrative that incorporates this snippet (word-for-word match)"),
});

const EventNarrationSchema = z.object({
  eventNumber: z
    .number()
    .describe("The sequential number of the event (1, 2, 3, etc.)"),
  narration: z
    .string()
    .min(1)
    .describe(
      "Third-person omniscient narrative for this event (2-4 paragraphs) that incorporates all selected character details and shows their perspectives, thoughts, and interactions during this specific event.",
    ),
  snippetUsages: z.array(SnippetUsageSchema).describe(
    "Array of snippet usages showing exactly which parts of the narrative text incorporate which original character details. Each verbatimInNarrative must be an exact substring that appears in the narration.",
  ),
});

const ResponseSchema = z.object({
  narratives: z
    .array(EventNarrationSchema)
    .describe("Array of narratives, one for each event in chronological order"),
});

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: payload.error },
        { status: 400 },
      );
    }

    const { events } = payload.data;

    // Build comprehensive prompt with all events
    const eventsSection = events
      .map((eventData, eventIndex) => {
        const { eventTimeline, eventDescription, snippets } = eventData;

        const eventHeader = eventTimeline
          ? `${eventTimeline}${eventDescription ? `: ${eventDescription}` : ""}`
          : eventDescription
          ? `Event ${eventIndex + 1}: ${eventDescription}`
          : `Event ${eventIndex + 1}`;

        // If no snippets, just return the event header
        if (!snippets || snippets.length === 0) {
          return `${eventHeader}
  (No specific character details selected for this event - infer from overall story context)`;
        }

        // Group snippets by character name for this event
        const characterSnippets = new Map<
          string,
          { characterName: string; snippets: string[]; attributes: Set<string> }
        >();

        snippets.forEach((snippet) => {
          const key = snippet.characterName;
          if (!characterSnippets.has(key)) {
            characterSnippets.set(key, {
              characterName: snippet.characterName,
              snippets: [],
              attributes: new Set(),
            });
          }

          const charData = characterSnippets.get(key)!;
          charData.snippets.push(snippet.text);
          snippet.attributes.forEach((attr: string) =>
            charData.attributes.add(attr),
          );
        });

        const characterDetails = Array.from(characterSnippets.entries())
          .map(([_, data]) => {
            const attributeList = Array.from(data.attributes).join(", ");
            const snippetList = data.snippets
              .map((s, i) => `    ${i + 1}. "${s}"`)
              .join("\n");

            return `  Character: ${data.characterName}
  Attributes: ${attributeList}
  Selected details:
${snippetList}`;
          })
          .join("\n\n");

        return `${eventHeader}
${characterDetails}`;
      })
      .join("\n\n");

    const prompt = `You are a skilled narrative writer crafting a third-person omniscient story across multiple events.

EVENTS AND CHARACTER PERSPECTIVES:

${eventsSection}

INSTRUCTIONS:
Write a comprehensive third-person omniscient narrative that weaves together ALL the events above. For each event, create a rich story that:

1. **Third-Person Omniscient Point of View**: Reveal the inner thoughts, feelings, and perspectives of multiple characters
2. **Incorporate Selected Details**: For events with character details, seamlessly integrate ALL the provided snippets into the narrative
3. **Bridge Events Without Details**: For events without specific character details, create narrative continuity by inferring character states from surrounding events and the overall story arc
4. **Character Development**: Show how characters evolve, interact, and influence each other across the entire sequence
5. **Event-Specific Focus**: Each narrative should be 2-4 paragraphs capturing that specific event moment
6. **Chronological Continuity**: Maintain story flow and character consistency across ALL events, even those without specific details

SNIPPET USAGE TRACKING:
For each event with selected character details, you must identify exactly which parts of your narrative text incorporate which original snippets:
- In the "snippetUsages" array, provide pairs of (originalSnippet, verbatimInNarrative)
- "originalSnippet" should be the exact text from the selected details above
- "verbatimInNarrative" must be an EXACT substring from your generated narrative that shows how you used that snippet
- Each verbatimInNarrative should be a phrase or sentence (not a single word) that clearly demonstrates the snippet's influence
- Try to capture all significant uses of the provided character details

IMPORTANT:
- You must return a narrative for EVERY event, even if no specific character details are provided.
- For events without details, use your understanding of the characters from other events to create a coherent continuation of the story.
- For events without character details, snippetUsages should be an empty array.

Return one narrative for each event in the provided order.`;

    console.log("Multi-event narrative generation prompt:", prompt);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
    });

    if (!object?.narratives || object.narratives.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate narratives" },
        { status: 500 },
      );
    }

    // Map the generated narratives to their corresponding narrative nodes
    const narratives = events.map((eventData, index) => {
      const generatedNarrative = object.narratives.find(
        (n) => n.eventNumber === index + 1,
      );

      return {
        narrativeNodeId: eventData.narrativeNodeId,
        narration: generatedNarrative?.narration ?? "",
        snippetUsages: generatedNarrative?.snippetUsages ?? [],
      };
    });

    return NextResponse.json({ narratives });
  } catch (error) {
    console.error("Error generating narrative:", error);
    return NextResponse.json(
      { error: "Unable to generate narrative story" },
      { status: 500 },
    );
  }
}
