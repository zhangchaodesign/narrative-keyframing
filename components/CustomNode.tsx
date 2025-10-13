import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  isSelected?: boolean;
}

export default function CustomNode({ data }: NodeProps) {
  const nodeData = data as CustomNodeData;
  const isSelected = nodeData.isSelected || false;

  return (
    <div
      className={`
        px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer
        ${
          isSelected
            ? "bg-pink-500 text-white border-3 border-pink-700 scale-110"
            : "bg-pink-50 text-gray-900 border-2 border-pink-500 hover:border-pink-600 hover:shadow-md"
        }
      `}
      style={{
        minWidth: "100px",
        textAlign: "center",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-zinc-500 !w-2 !h-2"
      />
      <div>{nodeData.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-zinc-500 !w-2 !h-2"
      />
    </div>
  );
}
