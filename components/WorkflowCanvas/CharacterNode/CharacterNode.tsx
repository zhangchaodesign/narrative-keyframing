"use client";

import { useCallback, useMemo, useRef } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { CharacterMenu } from "@/components/WorkflowCanvas/CharacterNode/CharacterMenu";
import { TraitSection } from "@/components/shared/CharacterTraitSection";
import type { CharacterNodeType, CharacterTraits } from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
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
  }, [id, setNodes]);

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
    } catch (error) {
      console.error("Error refreshing character snapshot:", error);
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
  }, [data?.isRefreshing, id, nodes, setNodes]);

  const handleSelectAllTraits = useCallback(() => {
    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      if (!selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(id, trait);
      }
    });
  }, [allTraits, id, selectedEvidenceAttributes, toggleEvidenceAttribute]);

  const handleDeselectAllTraits = useCallback(() => {
    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(id, trait);
      if (selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(id, trait);
      }
    });
  }, [allTraits, id, selectedEvidenceAttributes, toggleEvidenceAttribute]);

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
        className="relative flex max-h-88 flex-col rounded-lg border-2 border-warning bg-white text-xs hover:shadow-lg"
      >
        {data?.showUpdatePrompt && !data?.isRefreshing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/10 p-3 text-center text-white backdrop-blur-xs">
            <div className="w-full max-w-xs rounded-lg bg-white/90 p-3 text-gray-900 shadow-lg">
              <p className="text-xs font-medium">
                Update the character sheet with the latest perspective?
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
              Updating snapshot...
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
              🧙 Character Snapshot
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
            className="flex-1 min-h-0 space-y-3 overflow-y-auto"
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
                  titleClass={titleClass}
                  chipClass={chipClass}
                  emptyClass={emptyClass}
                  selectedClass={selectedClass}
                  traits={traits[key] ?? []}
                  brainstormContext={brainstormContext}
                  onUpdateNodeData={updateNodeData}
                />
              ),
            )}
          </div>
        </div>
        <CustomHandle
          type="source"
          position={Position.Top}
          id="perspective"
          style={{
            background: "lightgray",
          }}
        />
      </div>
    </div>
  );
}
