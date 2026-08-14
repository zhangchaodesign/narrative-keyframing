"use client";

import { useCallback, useMemo, useRef } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { CharacterMenu } from "@/components/WorkflowCanvas/CharacterNode/CharacterMenu";
import { TraitSection } from "@/components/shared/CharacterTraitSection";
import type {
  CharacterNodeType,
  CharacterTraits,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import {
  CHARACTER_TRAIT_CATEGORIES,
  buildCharacterBrainstormContext,
  normalizeCharacterTraits,
  refreshCharacterSnapshotFromPerspective,
  type WorkflowNodesSetter,
} from "@/lib/utiils/characterUtils";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";

export function CharacterNode({ id, data }: NodeProps<CharacterNodeType>) {
  const colors = getCharacterColors(data?.name ?? id);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const traits = useMemo<CharacterTraits>(
    () => normalizeCharacterTraits(data?.traits),
    [data?.traits],
  );
  const characterName = data?.name?.trim() ?? "";
  const isNarratorDefined =
    characterName.length > 0 && !/^Character\s*\d*$/i.test(characterName);
  const brainstormContext = useMemo(
    () =>
      buildCharacterBrainstormContext({
        nodes,
        edges,
        characterNodeId: id,
      }),
    [edges, id, nodes],
  );
  const allTraits = useMemo(
    () =>
      CHARACTER_TRAIT_CATEGORIES.flatMap(
        ({ key }) =>
          traits[key]?.filter((trait) => trait.trim().length > 0) ?? [],
      ),
    [traits],
  );
  const areAllTraitsSelected = useMemo(() => {
    if (allTraits.length === 0) {
      return false;
    }
    return allTraits.every((trait) =>
      Boolean(
        selectedEvidenceAttributes?.[buildEvidenceAttributeKey(id, trait)],
      ),
    );
  }, [allTraits, id, selectedEvidenceAttributes]);

  const updateNodeData = useCallback(
    (
      updater: (
        current: CharacterTraits,
        name: string,
        perspectiveId: string,
      ) => CharacterNodeType["data"],
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id || node.type !== "character") {
            return node;
          }

          const currentData = node.data as CharacterNodeType["data"];
          const currentTraits = normalizeCharacterTraits(currentData?.traits);

          return {
            ...node,
            data: updater(
              currentTraits,
              currentData?.name ?? "",
              currentData?.perspectiveId ?? "",
            ),
          };
        }),
      );
    },
    [id, setNodes],
  );

  // Wrapper that updates character traits AND flags the linked perspective
  const updateCharacterTraits = useCallback(
    (
      updater: (
        current: CharacterTraits,
        name: string,
        perspectiveId: string,
      ) => CharacterNodeType["data"],
    ) => {
      setNodes((nodesState) => {
        // First, find the character node to get its perspectiveId
        const charNode = nodesState.find(
          (node) => node.id === id && node.type === "character",
        );
        const perspectiveId = (
          charNode?.data as CharacterNodeType["data"] | undefined
        )?.perspectiveId;

        return nodesState.map((node) => {
          // Update the character node (same as updateNodeData)
          if (node.id === id && node.type === "character") {
            const currentData = node.data as CharacterNodeType["data"];
            const currentTraits = normalizeCharacterTraits(currentData?.traits);

            return {
              ...node,
              data: updater(
                currentTraits,
                currentData?.name ?? "",
                currentData?.perspectiveId ?? "",
              ),
            };
          }

          // Flag the linked perspective to show update prompt
          if (
            perspectiveId &&
            node.id === perspectiveId &&
            node.type === "perspective"
          ) {
            const existingData = node.data as PerspectiveNodeType["data"];
            const hasReflection = Boolean(existingData?.reflection?.trim());
            if (!hasReflection) {
              return node;
            }
            return {
              ...node,
              data: {
                ...existingData,
                showUpdatePrompt: true,
              },
            };
          }

          return node;
        });
      });
    },
    [id, setNodes],
  );

  const handleDismissUpdatePrompt = useCallback(() => {
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "character") {
          return node;
        }
        const existingData = node.data as CharacterNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
          },
        };
      }),
    );
  }, [id, setNodes, data]);

  const handleConfirmUpdatePrompt = useCallback(async () => {
    if (data?.isRefreshing) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "character") {
          return node;
        }
        const existingData = node.data as CharacterNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            isRefreshing: true,
            showUpdatePrompt: false,
          },
        };
      }),
    );

    try {
      await refreshCharacterSnapshotFromPerspective({
        nodeId: id,
        nodes,
        setNodes: setNodes as WorkflowNodesSetter,
      });

      const updatedNode = nodes.find(
        (node): node is CharacterNodeType =>
          node.id === id && node.type === "character",
      );
    } catch (error) {
      console.error("Error refreshing character keyframe:", error);
    } finally {
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "character") {
            return node;
          }
          const existingData = node.data as CharacterNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isRefreshing: false,
            },
          };
        }),
      );
    }
  }, [
    data?.isRefreshing,
    data?.name,
    data?.perspectiveId,
    data?.traits,
    id,
    nodes,
    setNodes,
  ]);

  const handleSelectAllTraits = useCallback(() => {
    const traitsToSelect = allTraits.filter((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      return !selectedEvidenceAttributes?.[key];
    });

    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      if (!selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(id, trait);
      }
    });
  }, [
    allTraits,
    id,
    selectedEvidenceAttributes,
    toggleEvidenceAttribute,
    data?.name,
  ]);

  const handleDeselectAllTraits = useCallback(() => {
    const traitsToDeselect = allTraits.filter((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      return selectedEvidenceAttributes?.[key];
    });

    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      if (selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(id, trait);
      }
    });
  }, [
    allTraits,
    id,
    selectedEvidenceAttributes,
    toggleEvidenceAttribute,
    data?.name,
  ]);

  const handleToggleAllTraits = useCallback(() => {
    if (areAllTraitsSelected) {
      handleDeselectAllTraits();
    } else {
      handleSelectAllTraits();
    }
  }, [areAllTraitsSelected, handleDeselectAllTraits, handleSelectAllTraits]);

  return (
    <div className="group relative w-64">
      <div
        ref={containerRef}
        className={cn(
          "relative flex max-h-88 flex-col rounded-lg border-2 bg-white text-xs",
          isNarratorDefined
            ? "hover:shadow-lg"
            : "opacity-50 pointer-events-none",
          colors.border,
        )}
      >
        {data?.showUpdatePrompt && !data?.isRefreshing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/10 p-3 text-center text-white backdrop-blur-xs">
            <div className="w-full max-w-xs rounded-lg bg-white/90 p-3 text-gray-900 shadow-lg">
              <p className="text-xs font-medium">
                Update the character keyframe with the latest perspective?
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleDismissUpdatePrompt}
                  className="btn btn-xs"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpdatePrompt}
                  className="btn btn-xs btn-neutral"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
        {data?.isRefreshing && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-warning" />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Updating keyframe...
            </span>
          </div>
        )}
        <CharacterMenu nodeId={id} />
        <div className="flex flex-1 flex-col gap-2 p-3 min-h-0">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                geistMono.className,
                "text-[10px] font-semibold uppercase tracking-wide text-gray-800",
              )}
            >
              🧙 Character Keyframe
            </span>
            <button
              type="button"
              onClick={handleToggleAllTraits}
              className="btn btn-xs btn-ghost"
              disabled={allTraits.length === 0}
            >
              {areAllTraitsSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div>
            <p
              className={cn(
                geistMono.className,
                "text-base font-semibold tracking-wide text-gray-800",
              )}
            >
              {characterName ? characterName : "Unknown"}
            </p>
            {/* <div className="mt-2 w-full rounded bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-800">
              {characterName ? (
                characterName
              ) : (
                <span className="italic text-gray-500">
                  Set in the perspective cluster
                </span>
              )}
            </div> */}
          </div>

          <div
            className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1"
            onWheel={(event) => {
              if (event.ctrlKey || event.metaKey) {
                return;
              }
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation?.();
            }}
            onWheelCapture={(event) => {
              if (event.ctrlKey || event.metaKey) {
                return;
              }
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation?.();
            }}
          >
            {CHARACTER_TRAIT_CATEGORIES.map(
              ({
                key,
                label,
                titleClass,
                chipClass,
                emptyClass,
                selectedClass,
              }) => (
                <TraitSection
                  key={key}
                  nodeId={id}
                  category={key}
                  label={label}
                  sizeVariant="character-node"
                  titleClass={titleClass}
                  chipClass={chipClass}
                  emptyClass={emptyClass}
                  selectedClass={selectedClass}
                  traits={traits[key] ?? []}
                  brainstormContext={brainstormContext}
                  onUpdateNodeData={updateCharacterTraits}
                />
              ),
            )}
          </div>
        </div>
        <CustomHandle
          type="source"
          position={Position.Top}
          id="perspective"
          className="pointer-events-auto"
          style={{
            background: "lightgray",
          }}
        />
      </div>
      {!isNarratorDefined && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg">
          <span className="rounded bg-gray-800/80 px-2 py-1 text-[10px] font-medium text-white">
            Set a character name
          </span>
        </div>
      )}
    </div>
  );
}
