"use client";

import { useCallback, type ChangeEvent } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { TbPlus } from "react-icons/tb";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveGroupMenu } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveGroupMenu";
import { createNarrativeGroup } from "@/lib/utiils/workflowUtils";
import type {
  CharacterNodeType,
  GroupNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import { eventTracker } from "@/lib/utils";

const zoomSelector = (s: any) => s.transform[2] >= 0.9;

export function PerspectiveGroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const colors = getCharacterColors(data?.characterName ?? id);
  const showContent = useStore(zoomSelector);
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();

  const handleCharacterNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      const previousName = data?.characterName ?? "";

      if (previousName !== nextName) {
        eventTracker({
          action: "change_narrator_name",
          data: {
            clusterLabel: data?.label || "First-Person Limited Cluster",
            previousName,
            newName: nextName,
          },
        });
      }

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
                label: nextName
                  ? `${nextName}'s Perspective`
                  : "First-Person Limited Cluster",
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
    [id, data, setNodes],
  );

  const handleAddNarrativeGroup = useCallback(() => {
    const currentNodes = getNodes() as WorkflowNode[];
    const currentEdges = getEdges() as WorkflowEdge[];

    const eventBridgeEdge = currentEdges.find(
      (edge) =>
        edge.target === id &&
        edge.targetHandle === "group-bridge" &&
        edge.sourceHandle === "group-bridge",
    );

    const eventGroupId = eventBridgeEdge
      ? currentNodes.find(
          (node) =>
            node.id === eventBridgeEdge.source && node.type === "eventGroup",
        )?.id
      : undefined;

    const result = createNarrativeGroup(currentNodes, { eventGroupId });

    if (result.nodes.length === 0) {
      return;
    }

    const createdGroupNode = result.nodes.find(
      (node) => node.type === "narrativeGroup",
    );

    if (!createdGroupNode) {
      return;
    }

    eventTracker({
      action: "add_narrative_group",
      data: {
        perspectiveClusterLabel: data?.label || "First-Person Limited Cluster",
        characterName: data?.characterName || "",
        eventGroupId: eventGroupId || null,
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

    const perspectiveGroup = currentNodes.find(
      (node) => node.id === id && node.type === "perspectiveGroup",
    );
    const baselineHeight =
      typeof perspectiveGroup?.style?.height === "number"
        ? perspectiveGroup.style.height
        : 640;
    const targetX = perspectiveGroup?.position.x ?? createdGroupNode.position.x;
    const targetY =
      (perspectiveGroup?.position.y ?? createdGroupNode.position.y) +
      baselineHeight +
      80;

    const repositionedNodes = result.nodes.map((node) => {
      if (node.id === createdGroupNode.id) {
        return {
          ...node,
          position: {
            x: targetX,
            y: targetY,
          },
        };
      }
      return node;
    });

    const newGroupNode = repositionedNodes.find(
      (node) => node.type === "narrativeGroup",
    );

    if (!newGroupNode) {
      return;
    }

    const bridgingEdge: WorkflowEdge = {
      id: `edge-${id}-${newGroupNode.id}`,
      source: id,
      target: newGroupNode.id,
      sourceHandle: "narrative-bridge",
      targetHandle: "group-bridge",
      type: "customEdge",
      animated: true,
    };

    setNodes((nodes) => [...nodes, ...repositionedNodes]);
    setEdges((edges) => [...edges, ...result.edges, bridgingEdge]);
  }, [getEdges, getNodes, id, data, setEdges, setNodes]);

  return (
    <div className="group relative h-full w-full rounded-lg border-4 border-gray-200 shadow">
      <PerspectiveGroupMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "absolute left-1 top-1 rounded px-2 py-1 text-xs font-bold text-white",
          colors.label,
        )}
      >
        {data?.label}
      </div>
      <div className="absolute right-1 bottom-1 flex items-center gap-2 rounded bg-white border border-gray-300 px-2 py-1 text-xs font-semibold tracking-wide text-gray-800">
        <label className="flex items-center gap-2">
          <span>Narrator</span>
          <input
            value={data?.characterName ?? ""}
            onChange={handleCharacterNameChange}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder="Name..."
            className="w-28 rounded border border-transparent bg-gray-50 px-2 py-0.5 font-medium normal-case text-gray-700 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 nodrag nopan"
          />
        </label>
      </div>
      <div
        className={cn(
          geistMono.className,
          "absolute left-4 bottom-1 text-9xl font-semibold",
          colors.watermark,
        )}
      >
        {data?.characterName}
      </div>
      <div className="absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center">
        <button
          type="button"
          onClick={handleAddNarrativeGroup}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            geistMono.className,
            "btn btn-xs btn-neutral btn-soft gap-1 whitespace-nowrap nodrag nopan",
          )}
        >
          <TbPlus size={14} />
          Add a Third-Person Omniscient Cluster
        </button>
      </div>
      <CustomHandle type="target" position={Position.Top} id="group-bridge" />
      <CustomHandle
        type="source"
        position={Position.Bottom}
        id="narrative-bridge"
      />
    </div>
  );
}
