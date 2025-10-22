"use client";

import { useCallback, type ChangeEvent } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import { EventHandle } from "./EventHandle";
import { NodeActionMenu } from "./NodeActionMenu";
import type {
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "./workflow.constants";

const EVENT_HORIZONTAL_GAP = 300;

export function EventNode({ id, data }: NodeProps<EventNodeType>) {
  const { setNodes, setEdges, getNode, getNodes } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);

  const hasPreviousEvent = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "event-prev",
  );
  const hasNextEvent = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === "event-next",
  );

  const handleAddAdjacentEvent = useCallback(
    (direction: "before" | "after") => {
      const referenceNode = getNode(id);
      if (!referenceNode) {
        return;
      }

      const newNodeId = `event-${Date.now()}`;
      const eventCount = getNodes().filter(
        (node) => node.type === "event",
      ).length;
      const xOffset =
        direction === "before" ? -EVENT_HORIZONTAL_GAP : EVENT_HORIZONTAL_GAP;

      const newNode: EventNodeType = {
        id: newNodeId,
        type: "event",
        position: {
          x: referenceNode.position.x + xOffset,
          y: referenceNode.position.y,
        },
        data: {
          timeline: `Event ${eventCount + 1}`,
          description: "",
        },
        draggable: false,
      };

      setNodes((nodes) => [...nodes, newNode] as WorkflowNode[]);
      const newEdge: WorkflowEdge = {
        id: `edge-${
          direction === "before" ? `${newNodeId}-${id}` : `${id}-${newNodeId}`
        }-${Date.now()}`,
        source: direction === "before" ? newNodeId : id,
        target: direction === "before" ? id : newNodeId,
        sourceHandle: "event-next",
        targetHandle: "event-prev",
        type: "customEdge",
        animated: true,
      };
      setEdges((edgesState) => {
        const alreadyExists = edgesState.some(
          (edge) =>
            edge.source === newEdge.source &&
            edge.target === newEdge.target &&
            edge.sourceHandle === newEdge.sourceHandle &&
            edge.targetHandle === newEdge.targetHandle,
        );
        if (alreadyExists) {
          return edgesState;
        }
        return [...edgesState, newEdge];
      });
    },
    [getNode, getNodes, id, setEdges, setNodes],
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const updatedDescription = event.target.value;
      setNodes(
        (nodes) =>
          nodes.map((node) =>
            node.id === id && node.type === "event"
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    description: updatedDescription,
                  },
                }
              : node,
          ) as WorkflowNode[],
      );
    },
    [id, setNodes],
  );

  return (
    <div className="group relative w-64 rounded-lg border-2 border-zinc-500 bg-white p-3 text-xs hover:shadow-lg">
      {!hasPreviousEvent && (
        <button
          type="button"
          onClick={() => handleAddAdjacentEvent("before")}
          className="absolute left-[-320px] top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add event before"
          aria-label="Add event before"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Event</span>
        </button>
      )}
      {!hasNextEvent && (
        <button
          type="button"
          onClick={() => handleAddAdjacentEvent("after")}
          className="absolute right-[-320px] top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add event after"
          aria-label="Add event after"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Event</span>
        </button>
      )}
      <NodeActionMenu nodeId={id} />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
        📜 {data?.timeline}
      </div>
      <textarea
        value={data?.description ?? ""}
        onChange={handleDescriptionChange}
        placeholder="Describe the event..."
        rows={4}
        className="mt-2 w-full resize-none rounded border border-zinc-300 bg-white/70 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
      />
      <EventHandle type="target" position={Position.Left} id="event-prev" />
      <EventHandle type="source" position={Position.Right} id="event-next" />
      <CustomHandle type="source" position={Position.Bottom} id="narration" />
    </div>
  );
}
