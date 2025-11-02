"use client";

import { useMemo } from "react";
import { Position, type NodeProps, useStore } from "@xyflow/react";
import { NarrativeHandle } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeHandle";
import { NarrativeMenu } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeMenu";
import { NarrativeContent } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeContent";
import type { EventNodeType, NarrativeNodeType } from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

const DEFAULT_NARRATIVE_GROUP_ID = "narrative-group";

export function NarrativeNode({ id, data }: NodeProps<NarrativeNodeType>) {
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;

  // Find the event node and its timeline
  const eventTimeline = useMemo(() => {
    if (!data?.eventId) {
      return null;
    }
    const eventNode = nodes.find(
      (node) => node.id === data.eventId && node.type === "event",
    ) as EventNodeType | undefined;
    return eventNode?.data?.timeline ?? data.eventId;
  }, [data?.eventId, nodes]);

  return (
    <div className="group relative flex gap-2 h-48 w-64 flex-col rounded-lg border-2 border-primary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-green-600"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-green-600">
            Preparing narration...
          </span>
        </div>
      )}
      <NarrativeMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
        )}
      >
        <span className="flex items-center">📖 Narration</span>
      </div>

      <NarrativeContent
        narration={data?.narration ?? ""}
        snippetUsages={data?.snippetUsages}
      />
      {eventTimeline && (
        <div className="mt-1 flex gap-2">
          <span
            className={cn(
              geistMono.className,
              "inline-flex items-center rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
            )}
            title={`Event: ${data?.eventId}`}
          >
            {eventTimeline}
          </span>
        </div>
      )}
      <NarrativeHandle
        type="target"
        position={Position.Left}
        id="narrative-prev"
      />
      <NarrativeHandle
        type="source"
        position={Position.Right}
        id="narrative-next"
      />
    </div>
  );
}
