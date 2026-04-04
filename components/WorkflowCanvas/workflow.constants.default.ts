import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export const initialNodes: WorkflowNode[] = [
  {
    id: "event-group",
    type: "eventGroup",
    position: { x: 200, y: 20 },
    data: { label: "Plot Cluster", eventGroupId: 1 },
    style: {
      width: 1520,
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
      description: "",
      timeline: "Plot 1",
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
      description: "",
      timeline: "Plot 2",
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
      description: "",
      timeline: "Plot 3",
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
      description: "",
      timeline: "Plot 4",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-5",
    type: "event",
    position: { x: 1220, y: 60 },
    draggable: false,
    data: {
      description: "",
      timeline: "Plot 5",
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
  {
    id: "edge-event-4-5",
    source: "event-4",
    target: "event-5",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
];
