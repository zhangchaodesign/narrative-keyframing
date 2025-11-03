import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import {
  EVIDENCE_CATEGORIES,
  INDICATOR_DESCRIPTIONS,
  TRAIT_CATEGORIES,
  type EvidenceCategory,
  type EvidenceAnalysisResponse,
  type PerspectiveEvidenceTarget,
} from "@/lib/workflow/workflowEvidence";

const TraitCategorySchema = z.enum(TRAIT_CATEGORIES);
const EvidenceCategorySchema = z.enum(EVIDENCE_CATEGORIES);

const EvidenceRequestSchema = z.object({
  perspectiveId: z.string().min(1),
  reflection: z.string().optional().default(""),
  groupContext: z.string().optional().default(""),
  characters: z.array(
    z.object({
      characterId: z.string().min(1),
      characterName: z.string().min(1),
      attributes: z.array(
        z.object({
          traitCategory: TraitCategorySchema,
          value: z.string().min(1),
        }),
      ),
    }),
  ),
});

const EvidenceItemSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      "Verbatim evidence snippet copied exactly from the reflection text.",
    ),
  category: EvidenceCategorySchema,
  attributes: z.array(
    z
      .string()
      .min(1)
      .describe("Attribute values supported by this exact evidence snippet."),
  ),
});

const CharacterEvidenceSchema = z.object({
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  items: z.array(EvidenceItemSchema),
});

const EvidenceResultSchema = z.object({
  characterEvidence: z.array(CharacterEvidenceSchema),
});

const TRAIT_CATEGORY_LABELS: Record<(typeof TRAIT_CATEGORIES)[number], string> =
  {
    physiology: "Physiology",
    psychology: "Psychology",
    sociology: "Sociology",
  };

const buildCharacterSection = (
  characters: PerspectiveEvidenceTarget["characters"],
): string => {
  return characters
    .map((character, index) => {
      const lines: string[] = [];
      lines.push(`${index + 1}. ${character.characterName}`);

      let hasAttributes = false;
      for (const category of TRAIT_CATEGORIES) {
        const attributesInCategory = character.attributes
          .filter((attribute) => attribute.traitCategory === category)
          .map((attribute) => attribute.value);
        if (attributesInCategory.length === 0) {
          continue;
        }
        hasAttributes = true;
        lines.push(`   ${TRAIT_CATEGORY_LABELS[category]}:`);
        for (const attribute of attributesInCategory) {
          lines.push(`     - ${attribute}`);
        }
      }

      if (!hasAttributes) {
        lines.push("   (No attributes provided)");
      }

      return lines.join("\n");
    })
    .join("\n");
};

const buildEvidenceCategorySection = (): string => {
  return Object.entries(INDICATOR_DESCRIPTIONS)
    .map(([key, description]) => `- ${key}: ${description}`)
    .join("\n");
};

const buildPrompt = ({
  characters,
  reflection,
  groupContext,
}: {
  characters: PerspectiveEvidenceTarget["characters"];
  reflection: string;
  groupContext?: string;
}): string => {
  const characterSection = buildCharacterSection(characters);
  const evidenceCategorySection = buildEvidenceCategorySection();
  const trimmedContext = groupContext?.trim() ?? "";
  const contextSection =
    trimmedContext.length > 0
      ? `Full story (background only—do NOT quote from this section):\n<<<\n${trimmedContext}\n>>>\n\n`
      : "";

  return `You are an expert literary analyst. Identify direct textual evidence (i.e., verbatim phrases) that confirms the given character attributes.

${contextSection}Current snippet (ONLY source for evidence):
<<<
${reflection}
>>>

Characters and attributes to verify:
${characterSection}

Evidence categories to classify each phrase:
${evidenceCategorySection}

Instructions:
1. Scan the current snippet for exact short phrases that directly or indirectly demonstrate each listed attribute.
2. Only report evidence that appears verbatim in the current snippet text.
3. If an attribute is not supported, do not invent evidence for it.
4. When one phrase supports multiple attributes from the same category, list all matching attributes together.
5. Assign each phrase to exactly one evidence category from the list above.
6. Return characterEvidence entries in the same order as the character list above.
7. Return JSON that matches the provided schema exactly. Do not include explanations outside the schema.
`;
};

const normalizeEvidence = ({
  characters,
  reflection,
  rawEvidence,
}: {
  characters: PerspectiveEvidenceTarget["characters"];
  reflection: string;
  rawEvidence: z.infer<typeof EvidenceResultSchema>;
}) => {
  const responseEntries = rawEvidence.characterEvidence ?? [];
  const entryByName = new Map<string, (typeof responseEntries)[number]>();

  for (const entry of responseEntries) {
    const key = entry.characterName?.trim().toLowerCase();
    if (!key) continue;
    if (!entryByName.has(key)) {
      entryByName.set(key, entry);
    }
  }

  return characters.map((character) => {
    const canonicalName = character.characterName.trim();
    const entry = entryByName.get(canonicalName.toLowerCase()) ?? null;

    if (!entry) {
      return {
        characterId: character.characterId,
        characterName: canonicalName,
        items: [],
      };
    }

    const allowedValues = new Set(
      character.attributes
        .map((attribute) => attribute.value.trim())
        .filter((value) => value.length > 0),
    );

    const sanitizedItems = entry.items
      .map((item) => {
        const evidenceText = item.text.trim();
        if (!evidenceText) {
          return null;
        }
        if (!reflection.includes(evidenceText)) {
          return null;
        }

        const filteredAttributes = Array.from(
          new Set(
            item.attributes
              .map((attribute) => attribute.trim())
              .filter(
                (attribute) =>
                  attribute.length > 0 && allowedValues.has(attribute),
              ),
          ),
        );

        if (filteredAttributes.length === 0) {
          return null;
        }

        return {
          text: evidenceText,
          category: item.category,
          attributes: filteredAttributes,
        };
      })
      .filter(
        (
          item,
        ): item is {
          text: string;
          category: EvidenceCategory;
          attributes: string[];
        } => Boolean(item),
      );

    return {
      characterId: character.characterId,
      characterName: canonicalName,
      items: sanitizedItems,
    };
  });
};

export async function POST(request: Request) {
  try {
    const parsed = EvidenceRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const {
      perspectiveId,
      reflection = "",
      characters,
      groupContext = "",
    } = parsed.data;
    const trimmedReflection = reflection.trim();

    const characterEvidence: EvidenceAnalysisResponse["characterEvidence"] = [];

    if (trimmedReflection.length === 0) {
      characterEvidence.push(
        ...characters.map((character) => ({
          characterId: character.characterId,
          characterName: character.characterName,
          items: [],
        })),
      );
    } else {
      const charactersWithAttributes = characters.filter(
        (character) => character.attributes.length > 0,
      );

      if (charactersWithAttributes.length === 0) {
        characterEvidence.push(
          ...characters.map((character) => ({
            characterId: character.characterId,
            characterName: character.characterName,
            items: [],
          })),
        );
      } else {
        try {
          const prompt = buildPrompt({
            characters: charactersWithAttributes,
            reflection: trimmedReflection,
            groupContext,
          });
          console.log("Evidence analysis prompt:", prompt);

          const { object } = await generateObject({
            model: openai("gpt-4.1"),
            schema: EvidenceResultSchema,
            prompt: prompt,
          });

          characterEvidence.push(
            ...normalizeEvidence({
              characters,
              reflection: trimmedReflection,
              rawEvidence: object,
            }),
          );
        } catch (error) {
          console.error(
            `Failed to analyze evidence for perspective ${perspectiveId}:`,
            error,
          );
          characterEvidence.push(
            ...characters.map((character) => ({
              characterId: character.characterId,
              characterName: character.characterName,
              items: [],
            })),
          );
        }
      }
    }

    const payload: EvidenceAnalysisResponse = {
      perspectiveId,
      characterEvidence,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error handling evidence analysis request:", error);
    return NextResponse.json(
      { error: "Failed to analyze evidence" },
      { status: 500 },
    );
  }
}
