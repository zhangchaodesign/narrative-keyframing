"use client";

import type { NodeProps } from "@xyflow/react";
import type { GroupNodeType } from "@/lib/types/workflow";

export function PerspectiveGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded-lg border-2 border-primary bg-primary/3">
      <div className="absolute left-1 top-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-white shadow-sm">
        {data?.label}
      </div>
    </div>
  );
}
