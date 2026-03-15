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
    data: { label: "Story Draft", eventGroupId: 1 },
    style: {
      width: 920,
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
        "Dawn raid on the village. Aria breaks formation to save a trapped child. Lysa watches from the archive tower, documenting the chaos. Aria is publicly reprimanded and demoted to archive duty under Lysa's supervision.",
      timeline: "Act 1",
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
        "Evening in the archives. Aria discovers old battle records. Lysa shares tactical insights from historical texts. They clash over methods but gradually find common ground, planning an ambush strategy together.",
      timeline: "Act 2",
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
        "Night battle. Raiders return. Aria and Lysa execute their planned ambush, combining scout tactics with historical strategy. Victory without casualties.",
      timeline: "Act 3",
    },
    parentId: "event-group",
    extent: "parent",
  },
];

export const exampleEventDescriptions: string[] = [
  "Dawn raid on the village. Aria breaks formation to save a trapped child. Lysa watches from the archive tower, documenting the chaos. Aria is publicly reprimanded and demoted to archive duty under Lysa's supervision.",
  "Evening in the archives. Aria discovers old battle records. Lysa shares tactical insights from historical texts. They clash over methods but gradually find common ground, planning an ambush strategy together.",
  "Night battle. Raiders return. Aria and Lysa execute their planned ambush, combining scout tactics with historical strategy. Victory without casualties.",
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
];
