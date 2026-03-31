"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { NarrativeGroupMenu } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeGroupMenu";
import type { GroupNodeType } from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";

export function NarrativeGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const isActive = data?.isActiveInEditor ?? false;
  const baseLabel = data?.label ?? "Narrative Cluster";
  const labelWithId =
    typeof data?.narrativeGroupId === "number"
      ? `${baseLabel} ${data.narrativeGroupId}`
      : baseLabel;

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-lg border-4 shadow transition-all duration-300",
        isActive
          ? "outline-offset-0 outline-4 outline-green-500 border-green-100 bg-green-100/80 shadow-lg shadow-green-200/50"
          : "border-green-100 bg-green-50/50",
      )}
    >
      <NarrativeGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded px-2 py-1 text-xs font-bold transition-colors duration-300",
          isActive ? "bg-green-600 text-white" : "bg-primary text-white",
        )}
      >
        {labelWithId}
      </div>
      {isActive && (
        <div className="absolute right-1 top-1 flex items-center gap-1 rounded bg-green-600 px-2 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-200" />
          <span className="text-[10px] font-semibold text-white">
            IN EDITOR
          </span>
        </div>
      )}
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
