"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";
import { TraitSection } from "@/components/shared/CharacterTraitSection";
import { CharacterRefreshMenu } from "@/components/shared/CharacterActionsMenu";
import type {
  CharacterNodeData,
  CharacterNodeType,
  CharacterTraits,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import {
  CHARACTER_TRAIT_CATEGORIES,
  buildCharacterBrainstormContext,
  normalizeCharacterTraits,
  refreshCharacterSnapshotFromPerspective,
  type WorkflowNodesSetter,
} from "@/lib/utiils/characterUtils";

interface CharacterBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
  narratorName?: string;
}

export function CharacterBlock({
  item,
  timeToPixel,
  timelineScale,
  narratorName,
}: CharacterBlockProps) {
  const colors = getCharacterColors(narratorName ?? item.nodeId);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const characterNode = useWorkflowStore(
    useCallback(
      (state) =>
        state.nodes.find(
          (node) => node.id === item.nodeId && node.type === "character",
        ) ?? null,
      [item.nodeId],
    ),
  );

  const characterData = useMemo(
    () => (characterNode?.data as CharacterNodeData | undefined) ?? undefined,
    [characterNode],
  );

  const traits = useMemo<CharacterTraits>(
    () => normalizeCharacterTraits(characterData?.traits),
    [characterData?.traits],
  );

  const characterName = characterData?.name?.trim() ?? "";
  const isDefaultName =
    characterName.length === 0 ||
    /^(Character\s*\d*|Unknown)$/i.test(characterName);
  const isRefreshing = Boolean(characterData?.isRefreshing);
  const brainstormContext = useMemo(() => {
    if (!characterNode) {
      return null;
    }
    return buildCharacterBrainstormContext({
      nodes,
      edges,
      characterNodeId: characterNode.id,
    });
  }, [characterNode, edges, nodes]);
  const [nameValue, setNameValue] = useState(characterName);
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
        selectedEvidenceAttributes?.[
          buildEvidenceAttributeKey(item.nodeId, trait)
        ],
      ),
    );
  }, [allTraits, item.nodeId, selectedEvidenceAttributes]);

  useEffect(() => {
    setNameValue(characterName);
  }, [characterName]);

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const updateCharacterNode = useCallback(
    (
      updater: (
        currentTraits: CharacterTraits,
        currentName: string,
        currentPerspectiveId: string,
      ) => CharacterNodeData,
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "character") {
            return node;
          }

          const currentData = node.data as CharacterNodeData | undefined;
          const currentTraits = normalizeCharacterTraits(currentData?.traits);

          return {
            ...node,
            data: {
              ...currentData,
              ...updater(
                currentTraits,
                currentData?.name ?? "",
                currentData?.perspectiveId ?? "",
              ),
            },
          };
        }),
      );
    },
    [item.nodeId, setNodes],
  );

  // Wrapper that updates character traits AND flags the linked perspective
  const updateCharacterTraits = useCallback(
    (
      updater: (
        currentTraits: CharacterTraits,
        currentName: string,
        currentPerspectiveId: string,
      ) => CharacterNodeData,
    ) => {
      setNodes((nodesState) => {
        // First, find the character node to get its perspectiveId
        const charNode = nodesState.find(
          (node) => node.id === item.nodeId && node.type === "character",
        );
        const perspectiveId = (charNode?.data as CharacterNodeData | undefined)
          ?.perspectiveId;

        return nodesState.map((node) => {
          // Update the character node (same as updateCharacterNode)
          if (node.id === item.nodeId && node.type === "character") {
            const currentData = node.data as CharacterNodeData | undefined;
            const currentTraits = normalizeCharacterTraits(currentData?.traits);

            return {
              ...node,
              data: {
                ...currentData,
                ...updater(
                  currentTraits,
                  currentData?.name ?? "",
                  currentData?.perspectiveId ?? "",
                ),
              },
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
    [item.nodeId, setNodes],
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setNameValue(nextValue);
      updateCharacterNode(
        (currentTraits, _currentName, currentPerspectiveId) => ({
          name: nextValue,
          traits: currentTraits,
          perspectiveId: currentPerspectiveId,
        }),
      );
    },
    [updateCharacterNode],
  );

  const handleSelectAllTraits = useCallback(() => {
    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(item.nodeId, trait);
      if (!selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(item.nodeId, trait);
      }
    });
  }, [
    allTraits,
    item.nodeId,
    selectedEvidenceAttributes,
    toggleEvidenceAttribute,
  ]);

  const handleDeselectAllTraits = useCallback(() => {
    allTraits.forEach((trait) => {
      const key = buildEvidenceAttributeKey(item.nodeId, trait);
      if (selectedEvidenceAttributes?.[key]) {
        toggleEvidenceAttribute(item.nodeId, trait);
      }
    });
  }, [
    allTraits,
    item.nodeId,
    selectedEvidenceAttributes,
    toggleEvidenceAttribute,
  ]);

  const handleToggleAllTraits = useCallback(() => {
    if (areAllTraitsSelected) {
      handleDeselectAllTraits();
    } else {
      handleSelectAllTraits();
    }
  }, [areAllTraitsSelected, handleDeselectAllTraits, handleSelectAllTraits]);

  const handleDismissUpdatePrompt = useCallback(() => {
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== item.nodeId || node.type !== "character") {
          return node;
        }
        const existingData = node.data as CharacterNodeData;
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
          },
        };
      }),
    );
  }, [characterData?.name, characterData?.traits, item.nodeId, setNodes]);

  const handleConfirmUpdatePrompt = useCallback(async () => {
    if (characterData?.isRefreshing) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== item.nodeId || node.type !== "character") {
          return node;
        }
        const existingData = node.data as CharacterNodeData;
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
        nodeId: item.nodeId,
        nodes,
        setNodes: setNodes as WorkflowNodesSetter,
      });

      const updatedNode = nodes.find(
        (node): node is CharacterNodeType =>
          node.id === item.nodeId && node.type === "character",
      );
    } catch (error) {
      console.error("Error refreshing character keyframe:", error);
    } finally {
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== item.nodeId || node.type !== "character") {
            return node;
          }
          const existingData = node.data as CharacterNodeData;
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
    characterData?.isRefreshing,
    characterData?.name,
    characterData?.perspectiveId,
    characterData?.traits,
    item.nodeId,
    nodes,
    setNodes,
  ]);

  const nameInputPlaceholder = characterName ? characterName : "Unknown";

  return (
    <div
      className="absolute top-1 bottom-1"
      style={{
        left: `${leftPosition}px`,
        width: `${itemWidth}px`,
      }}
    >
      <div
        className={cn(
          "group relative flex h-full flex-col rounded-lg border-2 bg-white text-xs text-gray-800 transition-shadow",
          isDefaultName ? "opacity-50 pointer-events-none" : "hover:shadow-lg",
          colors.border,
        )}
      >
        {characterData?.showUpdatePrompt && !isRefreshing && (
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
        {isRefreshing && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-warning"></span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-warning">
              Updating keyframe...
            </span>
          </div>
        )}
        <CharacterRefreshMenu
          nodeId={item.nodeId}
          buttonPadding="p-1.5"
          iconSize={16}
          linkedTooltip={`Refresh ${
            characterName || "character"
          } from perspective`}
          ariaLabelLinked={`Refresh ${
            characterName || "character"
          } from perspective`}
          classes="-top-12"
        />
        <div className="flex flex-1 flex-col gap-3 p-3 min-h-0">
          <div className="flex items-center justify-between">
            <div
              className={cn(
                geistMono.className,
                "text-xs font-semibold uppercase tracking-wide text-gray-800",
              )}
            >
              🧙 Character Keyframe
            </div>
            <button
              type="button"
              onClick={handleToggleAllTraits}
              className="btn btn-xs btn-ghost"
              disabled={allTraits.length === 0}
            >
              {areAllTraitsSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div
            className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-2"
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
                  nodeId={item.nodeId}
                  category={key}
                  label={label}
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
      </div>
      {isDefaultName && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg">
          <span className="rounded bg-gray-800/80 px-2 py-1 text-xs font-medium text-white">
            Set a character name
          </span>
        </div>
      )}
    </div>
  );
}
