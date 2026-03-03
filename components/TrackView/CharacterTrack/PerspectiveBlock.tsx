"use client";

import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import type { PerspectiveNodeType } from "@/lib/types/workflow";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { PerspectiveSingleActionsMenu } from "@/components/shared/PerspectiveNodeMenu";
import { PerspectiveContent } from "@/components/shared/PerspectiveContent";
import { PerspectiveStatusLabel } from "@/components/shared/PerspectiveStatusLabel";

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
          if (node.id !== item.nodeId || node.type !== "perspective") {
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
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-secondary"></span>
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
              Preparing perspective...
            </span>
          </div>
        )}
        <PerspectiveSingleActionsMenu
          nodeId={item.nodeId}
          isEditing={isEditing}
          onToggleEdit={handleToggleEdit}
          wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        />
        <div
          className={cn(
            geistMono.className,
            "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-800",
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
        />
      </div>
    </div>
  );
}
