"use client";

import { X } from "lucide-react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import type { PaymentProviderNodeType } from "./workflow.constants";

export function PaymentProviderNode({
  id,
  data,
}: NodeProps<PaymentProviderNodeType>) {
  const { setNodes } = useReactFlow();

  const onDelete = () => {
    setNodes((prev) => prev.filter((node) => node.id !== id));
  };

  return (
    <div className="flex w-28 items-center gap-1.5 rounded-full border border-indigo-400 bg-white px-2 py-1 text-[10px]">
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
        {data?.code ?? "--"}
      </div>
      <span className="truncate text-[10px] font-medium text-slate-800">
        {data?.name ?? "Provider"}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border border-red-200 bg-transparent text-[10px] text-red-500 transition hover:bg-red-500 hover:text-white"
        aria-label="Delete payment provider node"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
      <CustomHandle type="target" position={Position.Left} />
    </div>
  );
}
