import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

import {
  EVIDENCE_CATEGORIES,
  INDICATOR_DESCRIPTIONS,
  TRAIT_CATEGORIES,
  type EvidenceCategory,
  type EvidenceAnalysisResponse,
  type PerspectiveEvidenceTarget,
} from "@/lib/types/perspective";

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

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/extract-evidence/extract_evidence.yaml",
);

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
  data: {
    contextSection: string;
    reflection: string;
    characterSection: string;
    evidenceCategorySection: string;
  },
) =>
  template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "context_section":
        return data.contextSection;
      case "reflection":
        return data.reflection;
      case "character_section":
        return data.characterSection;
      case "evidence_category_section":
        return data.evidenceCategorySection;
      default:
        return match;
    }
  });

const buildCharacterSection = (
  characters: PerspectiveEvidenceTarget["characters"],
): string => {
  return characters
    .map((character, index) => {
      const lines: string[] = [];
      lines.push(`${character.characterName}`);

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

const buildPrompt = async ({
  characters,
  reflection,
  groupContext,
}: {
  characters: PerspectiveEvidenceTarget["characters"];
  reflection: string;
  groupContext?: string;
}): Promise<string> => {
  const characterSection = buildCharacterSection(characters);
  const evidenceCategorySection = buildEvidenceCategorySection();
  const trimmedContext = groupContext?.trim() ?? "";
  const contextSection =
    trimmedContext.length > 0
      ? `Full story (background only—do NOT quote from this section):\n<<<\n${trimmedContext}\n>>>\n\n`
      : "";

  const template = await loadPromptTemplate(TEMPLATE_PATH);
  return renderPromptTemplate(template, {
    contextSection,
    reflection,
    characterSection,
    evidenceCategorySection,
  });
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
          const prompt = await buildPrompt({
            characters: charactersWithAttributes,
            reflection: trimmedReflection,
            groupContext,
          });
          console.log("Evidence analysis prompt:", prompt);

          const { object } = await generateObject({
            model: openai("gpt-5.3-chat-latest"),
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
