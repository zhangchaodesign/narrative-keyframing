export const TRAIT_CATEGORIES = [
  "physiology",
  "psychology",
  "sociology",
] as const;

export type TraitCategory = (typeof TRAIT_CATEGORIES)[number];

export const EVIDENCE_CATEGORIES = [
  "directDefinition",
  "actions",
  "speech",
  "appearance",
  "environment",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const INDICATOR_DESCRIPTIONS: Record<EvidenceCategory, string> = {
  directDefinition:
    "Explicit direct statements or labels about the character (e.g., 'old man', 'tall woman', 'brave soldier')",
  actions:
    "Physical actions, behaviors, or body language (e.g., 'moved slowly', 'frowned', 'clenched his fists')",
  speech:
    "What the character says, how they speak, or how other characters say about them (e.g., 'shouted angrily', 'whispered softly')",
  appearance:
    "Visual descriptions of the character (e.g., 'gray hair', 'wrinkled skin', 'piercing blue eyes')",
  environment:
    "Surroundings, context, or setting that characterizes the person (e.g., 'in his mansion', 'wearing rags')",
};

export type CharacterAttributePayload = {
  traitCategory: TraitCategory;
  value: string;
};

export type CharacterEvidenceTarget = {
  characterId: string;
  characterName: string;
  attributes: CharacterAttributePayload[];
};

export type PerspectiveEvidenceTarget = {
  perspectiveId: string;
  reflection: string;
  characters: CharacterEvidenceTarget[];
  groupContext: string;
};

export type EvidenceAnalysisRequest = PerspectiveEvidenceTarget | null;

export type EvidenceItemResult = {
  text: string;
  category: EvidenceCategory;
  attributes: string[];
};

export type CharacterEvidenceResult = {
  characterId: string;
  characterName: string;
  items: EvidenceItemResult[];
};

export type EvidenceAnalysisResult = {
  characterEvidence: CharacterEvidenceResult[];
};

export type EvidenceAnalysisResponse = {
  perspectiveId: string;
  characterEvidence: CharacterEvidenceResult[];
};

export type CharacterSnapshotPayload = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export type PerspectiveTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots: CharacterSnapshotPayload[];
};

export type GeneratePerspectiveResponse = {
  perspectives: Array<{
    reflection: string;
  }>;
};

export type GenerateSinglePerspectiveResponse = {
  reflection: string;
};

export type PerspectivePreparationResult = {
  eventSequence: Array<{
    label: string;
    description: string;
  }>;
  tasks: PerspectiveTaskPayload[];
};
