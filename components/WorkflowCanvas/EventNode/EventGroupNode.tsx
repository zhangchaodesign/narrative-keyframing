"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import type { GroupNodeType } from "@/lib/types/workflow";

export function EventGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded-lg border-2 border-primary bg-primary/3">
      <div className="absolute left-1 top-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-white shadow-sm">
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
