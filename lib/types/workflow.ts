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
};

export type EventNodeType = Node<EventNodeData, "event">;
export type PerspectiveNodeType = Node<PerspectiveNodeData, "perspective">;
export type CharacterNodeType = Node<CharacterNodeData, "character">;
export type EventGroupNodeType = Node<GroupNodeData, "eventGroup">;
export type NarrationGroupNodeType = Node<GroupNodeData, "perspectiveGroup">;

// Deprecated: Use EventGroupNodeType instead
export type GroupNodeType = Node<GroupNodeData, "group">;

export type WorkflowNode =
  | EventNodeType
  | PerspectiveNodeType
  | CharacterNodeType
  | EventGroupNodeType
  | NarrationGroupNodeType
  | GroupNodeType;

export type WorkflowEdge = Edge & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
