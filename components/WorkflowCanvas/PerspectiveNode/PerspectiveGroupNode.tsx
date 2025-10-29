"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import type { GroupNodeType } from "@/lib/types/workflow";

export function PerspectiveGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded-lg border-2 border-zinc-300 bg-zinc-50/50">
      <div className="absolute left-1 top-1 rounded bg-secondary px-2 py-1 text-xs font-semibold text-white">
        {data?.label}
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
