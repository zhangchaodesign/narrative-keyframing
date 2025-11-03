import { type Edge, type Node } from "@xyflow/react";

export type EventNodeData = {
  description: string;
  timeline: string;
};

export type PerspectiveNodeData = {
  narrator: string;
  reflection: string;
  isLoading?: boolean;
  eventId: string;
  isAnalyzingEvidence?: boolean;
  analysisStatus?: "idle" | "running" | "success" | "error";
  analysisStatusMessage?: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
};

export type NarrativeNodeData = {
  narration: string;
  isLoading?: boolean;
  eventId: string;
  snippetUsages?: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
  }>;
};

export type CharacterTraits = {
  physiology: string[];
  psychology: string[];
  sociology: string[];
};

export type CharacterNodeData = {
  name: string;
  traits: CharacterTraits;
  perspectiveId: string;
};

export type PerspectiveEvidenceItem = {
  characterId: string;
  characterName: string;
  items: Array<{
    text: string;
    category: string;
    attributes: string[];
  }>;
};

export type GroupNodeData = {
  label: string;
  characterName?: string;
  isActiveInEditor?: boolean;
};

export type EventNodeType = Node<EventNodeData, "event">;
export type PerspectiveNodeType = Node<PerspectiveNodeData, "perspective">;
export type NarrativeNodeType = Node<NarrativeNodeData, "narrative">;
export type CharacterNodeType = Node<CharacterNodeData, "character">;
export type EventGroupNodeType = Node<GroupNodeData, "eventGroup">;
export type NarrationGroupNodeType = Node<GroupNodeData, "perspectiveGroup">;
export type ThirdPersonGroupNodeType = Node<GroupNodeData, "narrativeGroup">;

// Deprecated: Use EventGroupNodeType instead
export type GroupNodeType = Node<GroupNodeData, "group">;

export type WorkflowNode =
  | EventNodeType
  | PerspectiveNodeType
  | NarrativeNodeType
  | CharacterNodeType
  | EventGroupNodeType
  | NarrationGroupNodeType
  | ThirdPersonGroupNodeType
  | GroupNodeType;

export type WorkflowEdge = Edge & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
