"use client";

import type { NodeProps } from "@xyflow/react";
import type { GroupNodeType } from "@/lib/types/workflow";

export function NarrationGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded border-2 border-blue-300 bg-blue-50/30">
      <div className="absolute left-1 top-1 rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm">
        {data?.label}
      </div>
    </div>
  );
}
