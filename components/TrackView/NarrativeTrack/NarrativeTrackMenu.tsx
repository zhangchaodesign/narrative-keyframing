"use client";

import { useMemo } from "react";
import type { TimelineTrack } from "@/lib/types/timeline";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeActionsMenu } from "@/components/shared/NarrativeActionsMenu";
import { findNarrativeGroupIdFromTrackItems } from "@/lib/utiils/narrativeUtils";

interface NarrativeTrackMenuProps {
  track: TimelineTrack;
}

export function NarrativeTrackMenu({ track }: NarrativeTrackMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);

  const targetGroupId = useMemo(
    () => findNarrativeGroupIdFromTrackItems(track.items, nodes),
    [nodes, track.items],
  );

  if (!targetGroupId) {
    return null;
  }

  return (
    <NarrativeActionsMenu
      nodeId={targetGroupId}
      wrapperClassName="flex items-center gap-1"
      buttonPadding="p-1"
      iconSize={14}
    />
  );
}
