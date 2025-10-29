"use client";

import { useCallback, type ChangeEvent } from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveGroupMenu } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveGroupMenu";
import type {
  CharacterNodeType,
  GroupNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utils/utils";
import { geistMono } from "@/app/fonts";

export function PerspectiveGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const { setNodes } = useReactFlow<WorkflowNode, WorkflowEdge>();

  const handleCharacterNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === id && node.type === "perspectiveGroup") {
            const groupData = node.data ?? {};
            if (
              (groupData as { characterName?: string }).characterName ===
              nextName
            ) {
              return node;
            }
            return {
              ...node,
              data: {
                ...groupData,
                characterName: nextName,
              },
            };
          }

          if (node.parentId === id && node.type === "character") {
            const characterNode = node as CharacterNodeType;
            if (characterNode.data?.name === nextName) {
              return characterNode;
            }
            return {
              ...characterNode,
              data: {
                ...characterNode.data,
                name: nextName,
              },
            };
          }

          if (node.parentId === id && node.type === "perspective") {
            const perspectiveNode = node as PerspectiveNodeType;
            if (perspectiveNode.data?.narrator === nextName) {
              return perspectiveNode;
            }
            return {
              ...perspectiveNode,
              data: {
                ...perspectiveNode.data,
                narrator: nextName,
              },
            };
          }

          return node;
        }),
      );
    },
    [id, setNodes],
  );

  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-zinc-100 bg-zinc-50/50 shadow">
      <PerspectiveGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-secondary px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {data?.label}
      </div>
      <div className="absolute right-1 top-1 flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 text-xs font-semibold tracking-wide text-zinc-800">
        <label className="flex items-center gap-2">
          <span>Narrator</span>
          <input
            value={data?.characterName ?? ""}
            onChange={handleCharacterNameChange}
            placeholder="Name..."
            className="w-28 rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 font-medium normal-case text-zinc-700 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400"
          />
        </label>
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
    </div>
  );
}
