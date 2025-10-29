"use client";

import type { NodeProps } from "@xyflow/react";
import type { GroupNodeType } from "@/lib/types/workflow";

export function EventGroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="relative h-full w-full rounded border-2 border-zinc-300 bg-zinc-50/30">
      <div className="absolute left-1 top-1 rounded bg-zinc-500 px-2 py-1 text-xs font-semibold text-white shadow-sm">
        {data?.label}
      </div>
    </div>
  );
}
