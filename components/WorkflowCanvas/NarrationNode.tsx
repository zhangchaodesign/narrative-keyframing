"use client";

import { useMemo } from "react";
import { Position, type NodeProps, useStore } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import { NarrationHandle } from "./NarrationHandle";
import { NodeActionMenu } from "./NodeActionMenu";
import type { EventNodeType, NarrationNodeType } from "./workflow.constants";

export function NarrationNode({ id, data }: NodeProps<NarrationNodeType>) {
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);

  const connectedEventLabel = useMemo(() => {
    const eventEdge = edges.find(
      (edge) => edge.target === id && edge.targetHandle === "event",
    );
    if (!eventEdge) {
      return null;
    }

    const eventNode = nodes.find(
      (node) => node.id === eventEdge.source && node.type === "event",
    ) as EventNodeType | undefined;

    const timeline = eventNode?.data?.timeline?.trim();
    const description = eventNode?.data?.description?.trim();

    const label = timeline || description || eventNode?.id;
    if (!label) {
      return null;
    }

    if (label.startsWith("Event")) {
      return label;
    }

    return `Event ${label}`;
  }, [edges, id, nodes]);

  const eventLabel = connectedEventLabel?.trim() || "Event";
  const narratorName = data?.narrator?.trim() || "Unknown narrator";
  const eventBadgeClass =
    "inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600";
  const narratorBadgeClass =
    "inline-flex items-center rounded border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-yellow-600";

  return (
    <div className="group relative flex h-44 w-64 flex-col rounded-lg border-2 border-indigo-400 bg-white p-3 text-xs hover:shadow-lg">
      <NodeActionMenu nodeId={id} />
      <div className="flex w-full flex-wrap items-center gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase">
        <span className="flex items-center">💬 Narration of</span>
        <span className={eventBadgeClass}>{eventLabel}</span>
        <span className="flex items-center">from</span>
        <span className={narratorBadgeClass}>{narratorName}</span>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800">
        {data?.reflection}
      </div>
      <NarrationHandle
        type="target"
        position={Position.Left}
        id="narration-prev"
      />
      <NarrationHandle
        type="source"
        position={Position.Right}
        id="narration-next"
      />
      <CustomHandle type="target" position={Position.Top} id="event" />
      <CustomHandle type="target" position={Position.Bottom} id="character" />
    </div>
  );
}
