"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import type { GroupNodeType } from "@/lib/types/workflow";

export function PerspectiveGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded-lg border-2 border-secondary bg-secondary/3">
      <div className="absolute left-1 top-1 rounded bg-secondary px-2 py-1 text-xs font-semibold text-white shadow-sm">
        {data?.label}
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
