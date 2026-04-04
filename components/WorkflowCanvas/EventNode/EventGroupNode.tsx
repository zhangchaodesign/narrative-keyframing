"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Position, type NodeProps } from "@xyflow/react";
import { TbRefresh, TbPlus } from "react-icons/tb";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { EventGroupMenu } from "@/components/WorkflowCanvas/EventNode/EventGroupMenu";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { createPerspectiveGroup } from "@/lib/utiils/workflowUtils";
import type {
  GroupNodeType,
  EventNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { eventTracker } from "@/lib/utils";

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
  const baseLabel = data?.label ?? "Plot Cluster";
  const labelWithSequence =
    typeof data?.eventGroupId === "number"
      ? `${baseLabel} ${data.eventGroupId}`
      : baseLabel;

  const handleExtractCharacters = useCallback(async () => {
    if (isExtracting) {
      return;
    }

    setIsExtracting(true);

    const nodes = getNodes();
    const eventNodes = nodes.filter(
      (node): node is EventNodeType =>
        node.type === "event" && node.parentId === id,
    );

    if (eventNodes.length === 0) {
      setIsExtracting(false);
      return;
    }

    const events = eventNodes.map((node) => ({
      label: node.data.timeline || "Plot",
      description: node.data.description || "",
    }));

    try {
      eventTracker({
        action: "extract_characters",
        data: {
          eventGroupLabel: data?.label ?? "Plot Cluster",
          eventGroupNumber: data?.eventGroupId ?? 0,
          eventCount: eventNodes.length,
          events: events,
        },
      });

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

      eventTracker({
        action: "extract_characters_success",
        data: {
          characterCount: result.characters.length,
          characters: result.characters,
        },
      });
    } catch (error) {
      console.error("Character extraction error:", error);
      eventTracker({
        action: "extract_characters_error",
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } finally {
      setIsExtracting(false);
    }
  }, [id, data, getNodes, setExtractedCharacters, isExtracting]);

  const handleAddPerspectiveGroup = useCallback(
    (characterName: string) => {
      const currentNodes = getNodes() as WorkflowNode[];
      const currentEdges = getEdges() as WorkflowEdge[];

      const eventNodes = currentNodes.filter(
        (node): node is EventNodeType =>
          node.type === "event" && node.parentId === id,
      );

      const events = eventNodes.map((node) => ({
        label: node.data.timeline || "Plot",
        description: node.data.description || "",
      }));

      const result = createPerspectiveGroup(currentNodes, currentEdges, {
        characterName,
        eventGroupId: id,
      });

      if (result.nodes.length === 0) {
        return;
      }

      eventTracker({
        action: "add_perspective_group",
        data: {
          eventGroupLabel: data?.label ?? "Plot Cluster",
          eventGroupNumber: data?.eventGroupId ?? 0,
          characterName: characterName || "Custom",
          isCustom: characterName === "",
          eventCount: eventNodes.length,
          events: events,
          nodesCreated: result.nodes.length,
          edgesCreated: result.edges.length,
          createdNodes: result.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            data: node.data,
            position: node.position,
          })),
          createdEdges: result.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: edge.data,
          })),
        },
      });

      setNodes((nodes) => [...nodes, ...result.nodes]);
      setEdges((edges) => [...edges, ...result.edges]);
    },
    [id, data, getNodes, getEdges, setNodes, setEdges],
  );

  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-gray-100 bg-gray-50/50 shadow">
      <EventGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded bg-gray-500 px-2 py-1 text-xs font-bold text-white",
        )}
      >
        {labelWithSequence}
      </div>
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-row items-center gap-1">
        <button
          type="button"
          onClick={handleExtractCharacters}
          disabled={isExtracting}
          className="rounded-full p-2 transition hover:bg-gray-50 hover:text-gray-600"
          title="Extract characters from story draft"
        >
          {isExtracting ? (
            <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
          ) : (
            <TbRefresh size={18} className="text-gray-600" />
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
        <button
          type="button"
          onClick={() => handleAddPerspectiveGroup("")}
          className={cn(
            geistMono.className,
            "btn btn-xs btn-soft btn-neutral gap-1 whitespace-nowrap",
          )}
          title="Add a custom perspective group"
        >
          <TbPlus size={14} />
          Add a Character Arc
        </button>
      </div>

      <CustomHandle
        type="source"
        position={Position.Bottom}
        id="group-bridge"
        isValidConnection={(connection) => {
          const targetNode = getNodes().find(
            (node) => node.id === connection.target,
          );
          const isValid = targetNode?.type === "perspectiveGroup";

          if (!isValid && targetNode) {
            alert("This connection can only link to Perspective Group nodes!");
          }

          return isValid;
        }}
      />
    </div>
  );
}
