"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import type { GroupNodeType } from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

export function NarrativeGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-purple-100 bg-purple-50/50 shadow">
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-purple-600 px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {data?.label}
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
