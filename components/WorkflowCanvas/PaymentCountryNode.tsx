"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import type { PaymentCountryNodeType } from "./workflow.constants";

export function PaymentCountryNode({
  data,
}: NodeProps<PaymentCountryNodeType>) {
  return (
    <div className="flex w-32 items-center gap-2 rounded border border-slate-400 bg-slate-100 px-2 py-1 text-[10px]">
      <div className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white font-semibold text-slate-700">
        {data?.countryCode ?? "?"}
      </div>
      <div className="flex flex-col">
        <span className="truncate text-[11px] font-medium text-slate-800">
          {data?.country ?? "Unknown"}
        </span>
        <span className="text-[9px] text-slate-600">
          {data?.currency ?? ""}
        </span>
      </div>
      <CustomHandle type="source" position={Position.Right} />
      <CustomHandle type="target" position={Position.Left} />
    </div>
  );
}
