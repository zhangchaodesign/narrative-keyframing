"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import type { PaymentInitNodeType } from "./workflow.constants";

export function PaymentInitNode({ data }: NodeProps<PaymentInitNodeType>) {
  return (
    <div className="w-32 overflow-hidden rounded border border-purple-500 bg-white text-[10px]">
      <div className="bg-[#410566] px-2 py-1 font-semibold text-white">
        Payment Init
      </div>
      <div className="px-2 py-2 text-base font-semibold text-blue-600">
        ${typeof data?.amount === "number" ? data.amount.toFixed(2) : "0.00"}
      </div>
      <CustomHandle type="source" position={Position.Right} />
    </div>
  );
}
