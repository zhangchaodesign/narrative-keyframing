import { type Edge, type Node } from "@xyflow/react";

export type EventNodeData = {
  description: string;
  timeline: string;
};

export type NarrationNodeData = {
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
export type NarrationNodeType = Node<NarrationNodeData, "narration">;
export type CharacterNodeType = Node<CharacterNodeData, "character">;

export type WorkflowNode =
  | EventNodeType
  | NarrationNodeType
  | CharacterNodeType;

export type WorkflowEdge = Edge & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
