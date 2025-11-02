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
  snippets: z.array(SnippetSchema),
});

const RequestSchema = z.object({
  events: z.array(EventDataSchema).min(1),
});

const EventNarrationSchema = z.object({
  eventNumber: z.number().describe("The sequential number of the event (1, 2, 3, etc.)"),
  narration: z
    .string()
    .min(1)
    .describe(
      "Third-person omniscient narrative for this event (2-4 paragraphs) that incorporates all selected character details and shows their perspectives, thoughts, and interactions during this specific event.",
    ),
});

const ResponseSchema = z.object({
  narratives: z.array(EventNarrationSchema).describe(
    "Array of narratives, one for each event in chronological order",
  ),
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

        // Group snippets by character for this event
        const characterSnippets = new Map<
          string,
          { characterName: string; snippets: string[]; attributes: Set<string> }
        >();

        snippets.forEach((snippet) => {
          if (!characterSnippets.has(snippet.characterId)) {
            characterSnippets.set(snippet.characterId, {
              characterName: snippet.characterName,
              snippets: [],
              attributes: new Set(),
            });
          }

          const charData = characterSnippets.get(snippet.characterId)!;
          charData.snippets.push(snippet.text);
          snippet.attributes.forEach((attr: string) =>
            charData.attributes.add(attr),
          );
        });

        const eventHeader = eventTimeline
          ? `Event ${eventIndex + 1}: ${eventTimeline}${
              eventDescription ? ` - ${eventDescription}` : ""
            }`
          : eventDescription
            ? `Event ${eventIndex + 1}: ${eventDescription}`
            : `Event ${eventIndex + 1}`;

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
Write a comprehensive third-person omniscient narrative that weaves together ALL the events and character perspectives above. For each event, create a rich story that:

1. **Third-Person Omniscient Point of View**: Reveal the inner thoughts, feelings, and perspectives of multiple characters
2. **Incorporate ALL Selected Details**: Seamlessly integrate every snippet into the narrative in a natural way
3. **Character Development**: Show how characters evolve, interact, and influence each other
4. **Rich Storytelling**: Use sensory details, internal monologue, and emotional depth
5. **Event-Specific Focus**: Each narrative should be 2-4 paragraphs capturing that specific event moment
6. **Chronological Continuity**: Maintain story flow and character consistency across all events

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
