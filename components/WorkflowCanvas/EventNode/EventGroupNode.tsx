"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Position, type NodeProps } from "@xyflow/react";
import { TbRefresh, TbPlus } from "react-icons/tb";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { EventGroupMenu } from "@/components/WorkflowCanvas/EventNode/EventGroupMenu";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { createPerspectiveGroup } from "@/lib/workflow/addPerspectiveGroup";
import type {
  GroupNodeType,
  EventNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

export function EventGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const extractedCharacters = useWorkflowStore(
    (state) => state.extractedCharacters,
  );
  const setExtractedCharacters = useWorkflowStore(
    (state) => state.setExtractedCharacters,
  );
  const [isExtracting, setIsExtracting] = useState(false);

  const characters = extractedCharacters[id] || [];

  const handleExtractCharacters = useCallback(async () => {
    if (isExtracting) {
      return;
    }

    setIsExtracting(true);

    try {
      const nodes = getNodes();
      const eventNodes = nodes.filter(
        (node): node is EventNodeType =>
          node.type === "event" && node.parentId === id,
      );

      if (eventNodes.length === 0) {
        return;
      }

      const events = eventNodes.map((node) => ({
        label: node.data.timeline || "Event",
        description: node.data.description || "",
      }));

      const response = await fetch("/api/extract-characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error("Failed to extract characters");
      }

      const result = await response.json();
      // console.log("Character extraction result:", result);
      setExtractedCharacters(id, result.characters);
    } catch (error) {
      console.error("Character extraction error:", error);
    } finally {
      setIsExtracting(false);
    }
  }, [id, getNodes, setExtractedCharacters, isExtracting]);

  const handleAddPerspectiveGroup = useCallback(
    (characterName: string) => {
      const currentNodes = getNodes() as WorkflowNode[];
      const currentEdges = getEdges() as WorkflowEdge[];

      const result = createPerspectiveGroup(currentNodes, currentEdges, {
        characterName,
        eventGroupId: id,
      });

      if (result.nodes.length === 0) {
        return;
      }

      setNodes((nodes) => [...nodes, ...result.nodes]);
      setEdges((edges) => [...edges, ...result.edges]);
    },
    [id, getNodes, getEdges, setNodes, setEdges],
  );

  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-pink-100 bg-pink-50/50 shadow">
      <EventGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-pink-500 px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {data?.label}
      </div>
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-row items-center gap-1">
        <button
          type="button"
          onClick={handleExtractCharacters}
          disabled={isExtracting}
          className="rounded-full p-2 transition hover:bg-pink-50 hover:text-pink-600"
          title="Extract characters from story outline"
        >
          {isExtracting ? (
            <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-pink-600 border-t-transparent" />
          ) : (
            <TbRefresh size={18} className="text-pink-600" />
          )}
        </button>
        {characters.length > 0 && (
          <>
            {characters.map((character, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleAddPerspectiveGroup(character.name)}
                className={cn(
                  geistMono.className,
                  "btn btn-xs btn-outline btn-secondary gap-1 whitespace-nowrap",
                )}
                title={`Add perspective group for ${character.name} (${character.role})`}
              >
                <TbPlus size={14} />
                {character.name}
              </button>
            ))}
          </>
        )}
      </div>

      <CustomHandle
        type="source"
        position={Position.Bottom}
        id="group-bridge"
      />
    </div>
  );
}
