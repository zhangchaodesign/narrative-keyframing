import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export type {
  EventNodeData,
  PerspectiveNodeData,
  NarrativeNodeData,
  CharacterTraits,
  CharacterNodeData,
  EventNodeType,
  PerspectiveNodeType,
  NarrativeNodeType,
  CharacterNodeType,
  GroupNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";

export const initialNodes: WorkflowNode[] = [
  {
    id: "event-group",
    type: "eventGroup",
    position: { x: 200, y: 20 },
    data: { label: "Story Outline" },
    style: {
      width: 1200,
      height: 220,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    },
  },
  {
    id: "event-1",
    type: "event",
    position: { x: 20, y: 60 },
    draggable: false,
    data: {
      description:
        "Dawn raid on the village. Aria breaks formation to save a trapped child. Lysa watches from the archive tower, documenting the chaos.",
      timeline: "Event 1",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-2",
    type: "event",
    position: { x: 320, y: 60 },
    draggable: false,
    data: {
      description:
        "Council meeting. Aria is publicly reprimanded and demoted to archive duty under Lysa's supervision. Lysa reluctantly accepts her new charge.",
      timeline: "Event 2",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-3",
    type: "event",
    position: { x: 620, y: 60 },
    draggable: false,
    data: {
      description:
        "Evening in the archives. Aria discovers old battle records. Lysa shares tactical insights from historical texts. They plan an ambush strategy together.",
      timeline: "Event 3",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-4",
    type: "event",
    position: { x: 920, y: 60 },
    draggable: false,
    data: {
      description:
        "Night battle. Raiders return. Aria and Lysa execute their planned ambush, combining scout tactics with historical strategy. Victory without casualties.",
      timeline: "Event 4",
    },
    parentId: "event-group",
    extent: "parent",
  },
];

export const initialEdges: WorkflowEdge[] = [
  {
    id: "edge-event-1-2",
    source: "event-1",
    target: "event-2",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
  {
    id: "edge-event-2-3",
    source: "event-2",
    target: "event-3",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
  {
    id: "edge-event-3-4",
    source: "event-3",
    target: "event-4",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
];
