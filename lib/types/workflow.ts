import { type Edge, type Node } from "@xyflow/react";

export type EventNodeData = {
  description: string;
  timeline: string;
};

export type PerspectiveNodeData = {
  narrator: string;
  reflection: string;
  isLoading?: boolean;
};

export type CharacterTraits = {
  physiology: string[];
  psychology: string[];
  sociology: string[];
};

export type CharacterNodeData = {
  name: string;
  traits: CharacterTraits;
};

export type EventNodeType = Node<EventNodeData, "event">;
export type PerspectiveNodeType = Node<PerspectiveNodeData, "perspective">;
export type CharacterNodeType = Node<CharacterNodeData, "character">;

export type WorkflowNode =
  | EventNodeType
  | PerspectiveNodeType
  | CharacterNodeType;

export type WorkflowEdge = Edge & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
