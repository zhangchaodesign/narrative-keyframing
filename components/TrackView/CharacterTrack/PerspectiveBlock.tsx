"use client";

import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { PerspectiveSingleActionsMenu } from "@/components/shared/PerspectiveNodeMenu";
import { PerspectiveContent } from "@/components/shared/PerspectiveContent";
import { PerspectiveStatusLabel } from "@/components/shared/PerspectiveStatusLabel";
import {
  analyzeSinglePerspectiveEvidence,
  PERSPECTIVE_MESSAGES,
  regenerateSinglePerspective,
} from "@/lib/utiils/perspectiveUtils";

interface PerspectiveBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
  characterName?: string;
}

export function PerspectiveBlock({
  item,
  timeToPixel,
  timelineScale,
  characterName,
}: PerspectiveBlockProps) {
  const colors = getCharacterColors(characterName ?? item.nodeId);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const nodes = useWorkflowStore((state) => state.nodes);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReflection, setEditedReflection] = useState(item.content);

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === item.nodeId && node.type === "perspective",
  );
  const perspectiveData = perspectiveNode?.data;

  const isLoading = perspectiveData?.isLoading ?? false;
  const isAnalyzingEvidence = perspectiveData?.isAnalyzingEvidence ?? false;
  const analysisStatus = perspectiveData?.analysisStatus ?? "idle";
  const analysisStatusMessage = perspectiveData?.analysisStatusMessage?.trim();
  const hasReflectionContent = Boolean(perspectiveData?.reflection?.trim());

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Save the edited reflection
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id === item.nodeId && node.type === "perspective") {
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
          }

          if (
            node.type === "character" &&
            (node.data as CharacterNodeType["data"])?.perspectiveId ===
              item.nodeId
          ) {
            const existingData = node.data as CharacterNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                showUpdatePrompt: true,
              },
            };
          }

          return node;
        }),
      );
      setIsEditing(false);
    } else {
      // Enter edit mode
      setEditedReflection(perspectiveData?.reflection ?? "");
      setIsEditing(true);
    }
  }, [
    isEditing,
    editedReflection,
    perspectiveData?.reflection,
    item.nodeId,
    setNodes,
  ]);

  const handleReflectionChange = useCallback((newReflection: string) => {
    setEditedReflection(newReflection);
  }, []);

  const getPerspectiveEvidenceTarget = useWorkflowStore(
    (state) => state.getPerspectiveEvidenceTarget,
  );
  const preparePerspectiveGeneration = useWorkflowStore(
    (state) => state.preparePerspectiveGeneration,
  );
  const syncSelectedSnippetsFromEvidence = useWorkflowStore(
    (state) => state.syncSelectedSnippetsFromEvidence,
  );

  const computeNeighborReflections = useCallback(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === item.nodeId && node.type === "perspective",
    );
    if (!perspectiveNode || !perspectiveNode.parentId) {
      return {};
    }

    const sortedSiblings = nodes
      .filter(
        (node): node is PerspectiveNodeType =>
          node.type === "perspective" &&
          node.parentId === perspectiveNode.parentId,
      )
      .sort((a, b) => a.position.x - b.position.x);

    const currentIndex = sortedSiblings.findIndex(
      (node) => node.id === item.nodeId,
    );
    if (currentIndex < 0) {
      return {};
    }

    let previousPerspective: string | undefined;
    let nextPerspective: string | undefined;

    if (currentIndex > 0) {
      const content =
        sortedSiblings[currentIndex - 1]?.data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        previousPerspective = content;
      }
    }

    if (currentIndex < sortedSiblings.length - 1) {
      const content =
        sortedSiblings[currentIndex + 1]?.data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        nextPerspective = content;
      }
    }

    return { previousPerspective, nextPerspective };
  }, [item.nodeId, nodes]);

  const handleDismissUpdatePrompt = useCallback(() => {
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== item.nodeId || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
          },
        };
      }),
    );
  }, [item.nodeId, setNodes]);

  const handleConfirmUpdatePrompt = useCallback(async () => {
    if (isAnalyzingEvidence) {
      return;
    }

    // Dismiss the prompt and start regeneration + analysis.
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== item.nodeId || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
            isLoading: true,
            isAnalyzingEvidence: true,
            analysisStatus: "running",
            analysisStatusMessage: PERSPECTIVE_MESSAGES.ANALYZING,
            analysisEvidence: [],
          },
        };
      }),
    );

    try {
      const preparation = preparePerspectiveGeneration([item.nodeId]);
      const { previousPerspective, nextPerspective } =
        computeNeighborReflections();
      const reflection = await regenerateSinglePerspective({
        preparation,
        previousPerspective,
        nextPerspective,
      });

      const target = getPerspectiveEvidenceTarget(item.nodeId);
      const result = await analyzeSinglePerspectiveEvidence(
        target ? { ...target, reflection } : target,
      );
      const hasContent = reflection.trim().length > 0;

      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== item.nodeId || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              reflection,
              isLoading: false,
              isAnalyzingEvidence: false,
              analysisStatus: result.success ? "success" : "idle",
              analysisStatusMessage: hasContent
                ? result.message
                : PERSPECTIVE_MESSAGES.NEED_REFLECTION,
              analysisEvidence: hasContent ? result.evidence : [],
            },
          };
        }),
      );
      syncSelectedSnippetsFromEvidence();
    } catch (error) {
      console.error("Error regenerating perspective:", error);
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== item.nodeId || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isLoading: false,
              isAnalyzingEvidence: false,
            },
          };
        }),
      );
    }
  }, [
    computeNeighborReflections,
    getPerspectiveEvidenceTarget,
    isAnalyzingEvidence,
    item.nodeId,
    preparePerspectiveGeneration,
    setNodes,
    syncSelectedSnippetsFromEvidence,
  ]);

  const title = useMemo(
    () => `Perspective ${item.position + 1}`,
    [item.position],
  );

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
          "group relative flex h-full flex-col rounded-lg border-2 bg-white/95 px-3 py-2 text-xs text-gray-800 transition-shadow hover:shadow-lg",
          colors.border,
        )}
      >
        {perspectiveData?.showUpdatePrompt && !isAnalyzingEvidence && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/10 p-3 text-center text-white backdrop-blur-xs">
            <div className="w-full max-w-xs rounded-lg bg-white/90 p-3 text-gray-900 shadow-lg">
              <p className="text-xs font-medium">
                Update Perspective Keyframe?
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
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-secondary"></span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-secondary">
              Preparing perspective...
            </span>
          </div>
        )}
        <PerspectiveSingleActionsMenu
          nodeId={item.nodeId}
          isEditing={isEditing}
          onToggleEdit={handleToggleEdit}
          buttonPadding="p-1.5"
          iconSize={16}
          wrapperClassName="pointer-events-none absolute -top-12 right-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 z-10001"
        />
        <div
          className={cn(
            geistMono.className,
            "flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-800",
          )}
        >
          <span className="flex items-center gap-1" aria-hidden="true">
            <span>💬</span>
            <span>{title}</span>
          </span>
          <PerspectiveStatusLabel
            isAnalyzingEvidence={isAnalyzingEvidence}
            analysisStatus={analysisStatus}
            analysisStatusMessage={analysisStatusMessage}
            hasReflectionContent={hasReflectionContent}
          />
        </div>
        <PerspectiveContent
          perspectiveNodeId={item.nodeId}
          reflection={perspectiveData?.reflection ?? ""}
          analysisEvidence={perspectiveData?.analysisEvidence}
          isEditing={isEditing}
          onReflectionChange={handleReflectionChange}
          classes="text-xs"
        />
      </div>
    </div>
  );
}
