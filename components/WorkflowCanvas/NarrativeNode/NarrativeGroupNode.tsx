"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { NarrativeGroupMenu } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeGroupMenu";
import type { GroupNodeType } from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

export function NarrativeGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-green-100 bg-green-50/50 shadow">
      <NarrativeGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-primary px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {data?.label}
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
