import { z } from "zod";
import fs from "fs/promises";

const NewRequestSchema = z.object({
  baseline_story_text: z.string().min(1),
  baseline_act_text: z.string().min(1),
  character_name: z.string().optional(),
  existing_traits: z.array(z.string().min(1)).optional(),
});

const CamelRequestSchema = z.object({
  baselineStoryText: z.string().min(1),
  baselineActText: z.string().min(1),
  characterName: z.string().optional(),
  existingTraits: z.array(z.string().min(1)).optional(),
});

export const ResponseSchema = z.object({
  traits: z.array(z.string().min(1)).length(3),
});

export type NormalizedTraitPrompt = {
  baselineStoryText: string;
  baselineActText: string;
  characterName: string;
  existingTraitsText: string;
};

type ParseResult =
  | { success: true; data: NormalizedTraitPrompt }
  | { success: false; error: z.ZodError };

const normalizeExistingTraits = (traits?: string[]) => {
  const existingText = (traits ?? [])
    .map((trait) => trait.trim())
    .filter((trait) => trait.length > 0)
    .join(", ");
  return existingText.length > 0 ? existingText : "(none)";
};

export const parseTraitsRequest = (raw: unknown): ParseResult => {
  const rawRecord = raw as Record<string, unknown> | null;
  const hasBaselineSnake =
    rawRecord?.baseline_story_text !== undefined ||
    rawRecord?.baseline_act_text !== undefined;
  const hasBaselineCamel =
    rawRecord?.baselineStoryText !== undefined ||
    rawRecord?.baselineActText !== undefined;
  if (hasBaselineSnake) {
    const parsed = NewRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }
    const trimmedName = parsed.data.character_name?.trim() ?? "";
    const resolvedName = trimmedName.length > 0 ? trimmedName : "the character";
    return {
      success: true,
      data: {
        baselineStoryText: parsed.data.baseline_story_text.trim(),
        baselineActText: parsed.data.baseline_act_text.trim(),
        characterName: resolvedName,
        existingTraitsText: normalizeExistingTraits(
          parsed.data.existing_traits,
        ),
      },
    };
  }

  if (hasBaselineCamel) {
    const parsed = CamelRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }
    const trimmedName = parsed.data.characterName?.trim() ?? "";
    const resolvedName = trimmedName.length > 0 ? trimmedName : "the character";
    return {
      success: true,
      data: {
        baselineStoryText: parsed.data.baselineStoryText.trim(),
        baselineActText: parsed.data.baselineActText.trim(),
        characterName: resolvedName,
        existingTraitsText: normalizeExistingTraits(
          parsed.data.existingTraits,
        ),
      },
    };
  }

  return {
    success: false,
    error: new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Missing required baseline story/act text.",
        path: [],
      },
    ]),
  };
};

const stripTemplateIndent = (text: string) => {
  const lines = text.split("\n");
  const hasIndent = lines.every(
    (line) => line.trim().length === 0 || line.startsWith("  "),
  );
  if (!hasIndent) {
    return text;
  }
  return lines.map((line) => (line.startsWith("  ") ? line.slice(2) : line)).join("\n");
};

export const loadPromptTemplate = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  const match = raw.match(/template:\s*\|\n([\s\S]*)/);
  if (!match) {
    throw new Error(`Prompt template missing in ${filePath}`);
  }
  const template = stripTemplateIndent(match[1]);
  return template.trimEnd();
};

export const renderPromptTemplate = (
  template: string,
  data: NormalizedTraitPrompt,
) => {
  return template.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
    switch (key) {
      case "baseline_story_text":
        return data.baselineStoryText;
      case "baseline_act_text":
        return data.baselineActText;
      case "character_name":
        return data.characterName;
      case "existing_traits_text":
        return data.existingTraitsText;
      default:
        return match;
    }
  });
};
