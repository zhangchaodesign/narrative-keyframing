"use server";

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

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
  perspectives: z
    .array(
      z.object({
        narrator: z.string().min(1),
        reflection: z.string().min(1),
      }),
    )
    .default([]),
});

const RequestSchema = z.object({
  events: z.array(EventDataSchema).min(1),
  customPrompt: z.string().optional(),
});

const SnippetUsageSchema = z.object({
  originalSnippet: z.string(),
  verbatimInNarrative: z.string(),
});

const EventNarrationSchema = z.object({
  eventNumber: z.number(),
  narration: z.string().min(1),
  snippetUsages: z.array(SnippetUsageSchema),
});

const ResponseSchema = z.object({
  narratives: z.array(EventNarrationSchema),
});

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/generate-narrative/generate_narrative.yaml",
);

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const wordOverlapScore = (a: string, b: string): number => {
  const wordsA = new Set(normalizeText(a).split(" "));
  const wordsB = new Set(normalizeText(b).split(" "));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
};

const fuzzyMatchNarrator = (
  originalSnippet: string,
  snippets: Array<{ text: string; characterName: string }>,
): string | undefined => {
  if (!originalSnippet || snippets.length === 0) return undefined;

  // Try exact or substring match first
  const exactMatch = snippets.find(
    (s) =>
      s.text === originalSnippet ||
      originalSnippet.includes(s.text) ||
      s.text.includes(originalSnippet),
  );
  if (exactMatch) return exactMatch.characterName;

  // Try normalized exact match
  const normalizedSnippet = normalizeText(originalSnippet);
  const normalizedMatch = snippets.find(
    (s) => normalizeText(s.text) === normalizedSnippet,
  );
  if (normalizedMatch) return normalizedMatch.characterName;

  // Fall back to word overlap scoring
  let bestScore = 0;
  let bestMatch: string | undefined;
  for (const s of snippets) {
    const score = wordOverlapScore(originalSnippet, s.text);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = s.characterName;
    }
  }

  // Require at least 40% word overlap to consider it a match
  return bestScore >= 0.4 ? bestMatch : undefined;
};

const stripTemplateIndent = (text: string) => {
  const lines = text.split("\n");
  const hasIndent = lines.every(
    (line) => line.trim().length === 0 || line.startsWith("  "),
  );
  if (!hasIndent) {
    return text;
  }
  return lines
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n");
};

const loadPromptTemplate = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  const match = raw.match(/template:\s*\|\n([\s\S]*)/);
  if (!match) {
    throw new Error(`Prompt template missing in ${filePath}`);
  }
  const template = stripTemplateIndent(match[1]);
  return template.trimEnd();
};

const renderPromptTemplate = (
  template: string,
  data: { actsSection: string },
) =>
  template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "acts_section":
        return data.actsSection;
      default:
        return match;
    }
  });

const buildActsSection = (plots: z.infer<typeof EventDataSchema>[]) => {
  return plots
    .map((plot, index) => {
      const actNumber = index + 1;
      const actSummary = plot.eventDescription?.trim() ?? "";
      const snippets = plot.snippets ?? [];

      const lines: string[] = [`Plot ${actNumber}`, "<<<", actSummary, ">>>"];

      if (!snippets.length) {
        lines.push("Selected details: (none)");
      } else {
        lines.push("Selected details:");
        const snippetsByCharacter = new Map<
          string,
          {
            characterName: string;
            snippets: string[];
            attributes: string[];
            attributesSeen: Set<string>;
          }
        >();

        snippets.forEach((snippet) => {
          const key = snippet.characterName;
          if (!snippetsByCharacter.has(key)) {
            snippetsByCharacter.set(key, {
              characterName: snippet.characterName,
              snippets: [],
              attributes: [],
              attributesSeen: new Set(),
            });
          }

          const data = snippetsByCharacter.get(key)!;
          if (snippet.text) {
            data.snippets.push(snippet.text);
          }
          (snippet.attributes ?? []).forEach((attr) => {
            const cleaned = attr?.trim();
            if (!cleaned) {
              return;
            }
            if (!data.attributesSeen.has(cleaned)) {
              data.attributesSeen.add(cleaned);
              data.attributes.push(cleaned);
            }
          });
        });

        for (const data of snippetsByCharacter.values()) {
          const attributeList = data.attributes.filter(Boolean).join(", ");
          lines.push(`- Character: ${data.characterName}`);
          if (attributeList) {
            lines.push(`  Attributes: ${attributeList}`);
          }
          data.snippets.forEach((snippetText, snippetIndex) => {
            if (!snippetText) {
              return;
            }
            lines.push(`  ${snippetIndex + 1}. "${snippetText}"`);
          });
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
};

const ensureNarrationParagraphBreaks = (text: string): string => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return normalized;
  }

  // Respect explicit paragraph formatting from the model.
  if (/\n\s*\n/.test(normalized)) {
    return normalized;
  }

  const sentences =
    normalized
      .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0) ?? [];

  if (sentences.length >= 4) {
    const splitIndex = Math.ceil(sentences.length / 2);
    return `${sentences.slice(0, splitIndex).join(" ")}\n\n${sentences
      .slice(splitIndex)
      .join(" ")}`;
  }

  const words = normalized.split(/\s+/).filter((word) => word.length > 0);
  if (words.length >= 70) {
    const splitIndex = Math.ceil(words.length / 2);
    return `${words.slice(0, splitIndex).join(" ")}\n\n${words
      .slice(splitIndex)
      .join(" ")}`;
  }

  return normalized;
};

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: payload.error },
        { status: 400 },
      );
    }

    const { events, customPrompt } = payload.data;
    const actsSection = buildActsSection(events);
    const template = await loadPromptTemplate(TEMPLATE_PATH);
    const basePrompt = renderPromptTemplate(template, { actsSection });

    const trimmedPrompt = customPrompt?.trim();
    const prompt = trimmedPrompt
      ? `${basePrompt}

ADDITIONAL INSTRUCTIONS FROM USER:
${trimmedPrompt}`
      : basePrompt;

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

      // Enrich snippetUsages with narrator by fuzzy-matching originalSnippet to input snippets
      const enrichedSnippetUsages = (
        generatedNarrative?.snippetUsages ?? []
      ).map((usage) => {
        const narrator = fuzzyMatchNarrator(
          usage.originalSnippet,
          eventData.snippets,
        );
        return {
          ...usage,
          narrator,
        };
      });

      return {
        narrativeNodeId: eventData.narrativeNodeId,
        narration: ensureNarrationParagraphBreaks(
          generatedNarrative?.narration ?? "",
        ),
        snippetUsages: enrichedSnippetUsages,
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
