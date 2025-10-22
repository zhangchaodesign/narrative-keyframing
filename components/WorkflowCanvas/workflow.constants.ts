import { type Edge, type Node } from "@xyflow/react";

export type EventNodeData = {
  description: string;
  timeline: string;
};

export type NarrationNodeData = {
  narrator: string;
  reflection: string;
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

export type WorkflowEdge = Edge;

export const initialNodes: WorkflowNode[] = [
  {
    id: "event-1",
    type: "event",
    position: { x: 120, y: 80 },
    data: {
      description: "Describe the inciting incident...",
      timeline: "Event I",
    },
  },
  {
    id: "event-2",
    type: "event",
    position: { x: 420, y: 80 },
    data: {
      description: "Describe the rising conflict...",
      timeline: "Event II",
    },
  },
  {
    id: "event-3",
    type: "event",
    position: { x: 720, y: 80 },
    data: {
      description: "Describe the climactic choice...",
      timeline: "Event III",
    },
  },
  {
    id: "narration-1",
    type: "narration",
    position: { x: 120, y: 240 },
    data: {
      narrator: "Aria",
      reflection: "I had never seen the elders tremble until that day.",
    },
  },
  {
    id: "narration-2",
    type: "narration",
    position: { x: 420, y: 240 },
    data: {
      narrator: "Aria",
      reflection:
        "Every echo in the caverns sounded like a warning meant for me.",
    },
  },
  {
    id: "narration-3",
    type: "narration",
    position: { x: 720, y: 240 },
    data: {
      narrator: "Aria",
      reflection: "I gave up the relic, but what I gained was far greater.",
    },
  },
  {
    id: "character-start",
    type: "character",
    position: { x: 120, y: 450 },
    data: {
      name: "Aria",
      traits: {
        physiology: ["Quick-footed scout"],
        psychology: ["Curious", "Wants to prove herself"],
        sociology: ["Trusted by village elders"],
      },
    },
  },
  {
    id: "character-end",
    type: "character",
    position: { x: 720, y: 450 },
    data: {
      name: "Aria",
      traits: {
        physiology: ["Bearing relic's aura"],
        psychology: ["Resolute protector"],
        sociology: ["Guardian of the village"],
      },
    },
  },
];

export const initialEdges: WorkflowEdge[] = [
  {
    id: "edge-event-1-2",
    source: "event-1",
    target: "event-2",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-event-2-3",
    source: "event-2",
    target: "event-3",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-event-1-narration-1",
    source: "event-1",
    target: "narration-1",
    sourceHandle: "narration",
    targetHandle: "event",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-event-2-narration-2",
    source: "event-2",
    target: "narration-2",
    sourceHandle: "narration",
    targetHandle: "event",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-event-3-narration-3",
    source: "event-3",
    target: "narration-3",
    sourceHandle: "narration",
    targetHandle: "event",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-narration-1-2",
    source: "narration-1",
    target: "narration-2",
    sourceHandle: "narration-next",
    targetHandle: "narration-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-narration-2-3",
    source: "narration-2",
    target: "narration-3",
    sourceHandle: "narration-next",
    targetHandle: "narration-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-character-start-narration-1",
    source: "character-start",
    target: "narration-1",
    sourceHandle: "narration",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-character-end-narration-3",
    source: "character-end",
    target: "narration-3",
    sourceHandle: "narration",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
];
