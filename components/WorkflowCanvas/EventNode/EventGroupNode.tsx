"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import type { GroupNodeType } from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

export function EventGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded-lg border-4 border-pink-100 bg-pink-50/50 shadow">
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-pink-500 px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {data?.label}
      </div>
      <CustomHandle
        type="source"
        position={Position.Bottom}
        id="group-bridge"
      />
    </div>
  );
}
