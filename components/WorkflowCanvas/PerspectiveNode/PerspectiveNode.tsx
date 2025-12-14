"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveHandle } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveHandle";
import { PerspectiveMenu } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveMenu";
import { AddCharacterButton } from "@/components/WorkflowCanvas/PerspectiveNode/AddCharacterButton";
import { PerspectiveContent } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveContent";
import { PerspectiveStatusLabel } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveStatusLabel";
import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  PerspectiveNodeType,
  PerspectiveEvidenceItem,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

const CHARACTER_VERTICAL_GAP = 210;
const DEFAULT_NARRATION_GROUP_ID = "perspective-group";

type TraitEvidencePayload = {
  traitCategory: keyof CharacterTraits;
  trait: string;
  evidenceText: string;
};

type InterpolateCharacterResponse = {
  characterSnapshot?: {
    name: string;
    traits: CharacterTraits;
  };
  traitEvidence?: TraitEvidencePayload[];
};

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const { setNodes, setEdges, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;
  const isAnalyzingEvidence = data?.isAnalyzingEvidence ?? false;
  const analysisStatus = data?.analysisStatus ?? "idle";
  const analysisStatusMessage = data?.analysisStatusMessage?.trim();
  const hasReflectionContent = Boolean(data?.reflection?.trim());

  const [isEditing, setIsEditing] = useState(false);
  const [editedReflection, setEditedReflection] = useState(
    data?.reflection ?? "",
  );
  const [isInterpolatingCharacter, setIsInterpolatingCharacter] =
    useState(false);

  const hasDirectCharacter = useMemo(() => {
    const characterNode = nodes.find(
      (node) => node.data?.perspectiveId === id && node.type === "character",
    ) as CharacterNodeType | undefined;

    return Boolean(characterNode);
  }, [id, nodes]);

  // Find the event node and its timeline
  const eventTimeline = useMemo(() => {
    if (!data?.eventId) {
      return null;
    }
    const eventNode = nodes.find(
      (node) => node.id === data.eventId && node.type === "event",
    ) as EventNodeType | undefined;
    return eventNode?.data?.timeline ?? data.eventId;
  }, [data?.eventId, nodes]);

  // keep character nodes aligned with perspective node
  useEffect(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode) {
      return;
    }

    const connectedCharacterIds = edges
      .filter(
        (edge) =>
          edge.target === id &&
          edge.targetHandle === "character" &&
          edge.sourceHandle === "perspective",
      )
      .map((edge) => edge.source);
    if (connectedCharacterIds.length === 0) {
      return;
    }

    const uniqueCharacterIds = new Set(connectedCharacterIds);
    const connectedCharacters = nodes.filter(
      (node): node is CharacterNodeType =>
        node.type === "character" && uniqueCharacterIds.has(node.id),
    );
    if (connectedCharacters.length === 0) {
      return;
    }

    const targetX = perspectiveNode.position.x;
    const needsAlignment = connectedCharacters.some(
      (characterNode) => Math.abs(characterNode.position.x - targetX) > 0.5,
    );
    if (!needsAlignment) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((nodeState) => {
        if (
          nodeState.type === "character" &&
          uniqueCharacterIds.has(nodeState.id)
        ) {
          return {
            ...nodeState,
            position: {
              ...nodeState.position,
              x: targetX,
            },
          } as WorkflowNode;
        }
        return nodeState;
      }),
    );
  }, [edges, id, nodes, setNodes]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Save the edited reflection
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              reflection: editedReflection,
              // Clear evidence analysis when reflection is edited
              analysisEvidence: [],
              analysisStatus: "idle",
              analysisStatusMessage: undefined,
            },
          };
        }),
      );
      setIsEditing(false);
    } else {
      // Enter edit mode
      setEditedReflection(data?.reflection ?? "");
      setIsEditing(true);
    }
  }, [isEditing, editedReflection, data?.reflection, id, setNodes]);

  const handleReflectionChange = useCallback((newReflection: string) => {
    setEditedReflection(newReflection);
  }, []);

  // function to create a new character node linked to this perspective
  const handleCreateCharacter = useCallback(async () => {
    if (isInterpolatingCharacter) {
      return;
    }

    const hasCharacterEdge = edges.some(
      (edge) => edge.target === id && edge.targetHandle === "character",
    );
    if (hasCharacterEdge) {
      return;
    }

    const perspectiveNode =
      getNode(id) ??
      (nodes.find((node) => node.id === id && node.type === "perspective") as
        | PerspectiveNodeType
        | undefined);
    if (!perspectiveNode) {
      return;
    }

    setIsInterpolatingCharacter(true);
    try {
      const perspectiveData =
        perspectiveNode.data as PerspectiveNodeType["data"];
      const perspectiveText = perspectiveData?.reflection?.trim() || "";
      const narratorName = perspectiveData?.narrator?.trim() || "New Character";

      const groupId = perspectiveNode.parentId;
      const fullPerspectiveText = (() => {
        if (!groupId) {
          return perspectiveText;
        }

        const groupReflections = nodes
          .filter(
            (node): node is PerspectiveNodeType =>
              node.type === "perspective" && node.parentId === groupId,
          )
          .sort(
            (a, b) =>
              a.position.x - b.position.x || a.position.y - b.position.y,
          )
          .map((node) => (node.data?.reflection ?? "").trim())
          .filter((text) => text.length > 0)
          .join("\n\n");

        return groupReflections || perspectiveText;
      })();
      const timestamp = Date.now();
      const newCharacterId = `character-${timestamp}`;
      const newEdgeId = `edge-${newCharacterId}-${id}`;

      // Find nearby character snapshots for context
      const findNearbySnapshots = () => {
        // Get all perspectives in the same group
        const perspectivesInGroup = nodes.filter(
          (node): node is PerspectiveNodeType =>
            node.type === "perspective" && node.parentId === groupId,
        );

        // Sort by x position to get before/after perspectives
        const sortedPerspectives = perspectivesInGroup.sort(
          (a, b) => a.position.x - b.position.x,
        );

        const currentIndex = sortedPerspectives.findIndex(
          (node) => node.id === id,
        );

        const nearbySnapshots = [];

        // Find previous perspective's character
        if (currentIndex > 0) {
          const prevPerspective = sortedPerspectives[currentIndex - 1];
          const prevCharacter = nodes.find(
            (node): node is CharacterNodeType =>
              node.type === "character" &&
              node.data?.perspectiveId === prevPerspective.id,
          );

          if (prevCharacter?.data) {
            nearbySnapshots.push({
              name: prevCharacter.data.name,
              traits: prevCharacter.data.traits,
              position: "before" as const,
            });
          }
        }

        // Find next perspective's character
        if (currentIndex < sortedPerspectives.length - 1) {
          const nextPerspective = sortedPerspectives[currentIndex + 1];
          const nextCharacter = nodes.find(
            (node): node is CharacterNodeType =>
              node.type === "character" &&
              node.data?.perspectiveId === nextPerspective.id,
          );

          if (nextCharacter?.data) {
            nearbySnapshots.push({
              name: nextCharacter.data.name,
              traits: nextCharacter.data.traits,
              position: "after" as const,
            });
          }
        }

        return nearbySnapshots;
      };

      let characterTraits: CharacterTraits = {
        physiology: [],
        psychology: [],
        sociology: [],
      };
      let interpolatedEvidence: TraitEvidencePayload[] = [];

      // If perspective has text, interpolate character snapshot from LLM
      if (perspectiveText) {
        try {
          const nearbySnapshots = findNearbySnapshots();
          const eventNode = nodes.find(
            (node): node is EventNodeType =>
              node.id === perspectiveData.eventId && node.type === "event",
          );
          const eventDescription = eventNode?.data?.description;

          const response = await fetch("/api/interpolate-character", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              perspectiveText,
              fullPerspectiveText,
              narratorName,
              nearbySnapshots,
              eventDescription,
            }),
          });

          if (response.ok) {
            const result =
              (await response.json()) as InterpolateCharacterResponse;
            if (result.characterSnapshot?.traits) {
              characterTraits = result.characterSnapshot.traits;
            }
            if (Array.isArray(result.traitEvidence)) {
              interpolatedEvidence = result.traitEvidence;
            }
          } else {
            console.error(
              "Failed to interpolate character snapshot:",
              response.statusText,
            );
          }
        } catch (error) {
          console.error("Error calling interpolate-character API:", error);
        }
      }

      const perspectiveEvidenceItems = interpolatedEvidence
        .map((entry) => {
          const snippet = entry.evidenceText?.trim();
          const traitValue = entry.trait?.trim();
          if (!snippet || !traitValue) {
            return null;
          }
          return {
            text: snippet,
            category: entry.traitCategory,
            attributes: [traitValue],
          } as PerspectiveEvidenceItem["items"][number];
        })
        .filter(
          (
            item,
          ): item is PerspectiveEvidenceItem["items"][number] =>
            Boolean(item),
        );

      setNodes((nodesState) => {
        const characterNodes = nodesState.filter(
          (nodeState): nodeState is CharacterNodeType =>
            nodeState.type === "character",
        );
        const characterRowY =
          characterNodes[0]?.position.y ??
          perspectiveNode.position.y + CHARACTER_VERTICAL_GAP;

        const newCharacterNode: WorkflowNode = {
          id: newCharacterId,
          type: "character",
          position: {
            x: perspectiveNode.position.x,
            y: characterRowY,
          },
          data: {
            name: narratorName,
            traits: characterTraits,
            perspectiveId: id,
          },
          draggable: false,
          parentId: groupId ?? DEFAULT_NARRATION_GROUP_ID,
          extent: "parent",
        };

        const nodesWithCharacter = [...nodesState, newCharacterNode];

        if (perspectiveEvidenceItems.length === 0) {
          return nodesWithCharacter;
        }

        return nodesWithCharacter.map((nodeState) => {
          if (nodeState.id !== id || nodeState.type !== "perspective") {
            return nodeState;
          }

          const perspectiveData =
            (nodeState.data as PerspectiveNodeType["data"]) ?? undefined;
          const existingEvidence: PerspectiveEvidenceItem[] = Array.isArray(
            perspectiveData?.analysisEvidence,
          )
            ? (perspectiveData?.analysisEvidence as PerspectiveEvidenceItem[])
            : [];
          const filteredEvidence = existingEvidence.filter(
            (entry) => entry.characterId !== newCharacterId,
          );
          const evidenceEntry: PerspectiveEvidenceItem = {
            characterId: newCharacterId,
            characterName: narratorName,
            items: perspectiveEvidenceItems,
          };

          return {
            ...nodeState,
            data: {
              ...(perspectiveData ?? {}),
              analysisEvidence: [...filteredEvidence, evidenceEntry],
            } as PerspectiveNodeType["data"],
          };
        });
      });

      setEdges((edgesState) => [
        ...edgesState,
        {
          id: newEdgeId,
          source: newCharacterId,
          target: id,
          sourceHandle: "perspective",
          targetHandle: "character",
          type: "customEdge",
          animated: true,
        },
      ]);
    } finally {
      setIsInterpolatingCharacter(false);
    }
  }, [edges, getNode, id, isInterpolatingCharacter, nodes, setEdges, setNodes]);

  return (
    <div className="group relative flex gap-2 h-48 w-64 flex-col rounded-lg border-2 border-secondary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-secondary"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
            Preparing perspective...
          </span>
        </div>
      )}
      <PerspectiveMenu
        nodeId={id}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
      />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
        )}
      >
        <span className="flex items-center">💬 Perspective</span>
        <PerspectiveStatusLabel
          isAnalyzingEvidence={isAnalyzingEvidence}
          analysisStatus={analysisStatus}
          analysisStatusMessage={analysisStatusMessage}
          hasReflectionContent={hasReflectionContent}
        />
      </div>

      <PerspectiveContent
        perspectiveNodeId={id}
        reflection={data?.reflection ?? ""}
        analysisEvidence={data?.analysisEvidence}
        isEditing={isEditing}
        onReflectionChange={handleReflectionChange}
      />
      {eventTimeline && (
        <div className="mt-1 flex gap-2">
          <span
            className={cn(
              geistMono.className,
              "inline-flex items-center rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
            )}
            title={`Event: ${data?.eventId}`}
          >
            {eventTimeline}
          </span>
        </div>
      )}
      <PerspectiveHandle
        type="target"
        position={Position.Left}
        id="perspective-prev"
      />
      <PerspectiveHandle
        type="source"
        position={Position.Right}
        id="perspective-next"
      />
      {!hasDirectCharacter && (
        <AddCharacterButton
          onClick={handleCreateCharacter}
          disabled={isLoading}
          isProcessing={isInterpolatingCharacter}
        />
      )}
      <CustomHandle
        type="target"
        position={Position.Bottom}
        id="character"
        style={{
          background: "lightgray",
        }}
      />
    </div>
  );
}
