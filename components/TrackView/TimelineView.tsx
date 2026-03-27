"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { TimelineRuler } from "@/components/TrackView/TimelineRuler";
import { EventTrack } from "@/components/TrackView/EventTrack/EventTrack";
import { CharacterTrack } from "@/components/TrackView/CharacterTrack/CharacterTrack";
import { NarrativeTrack } from "@/components/TrackView/NarrativeTrack/NarrativeTrack";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_LEFT_PADDING,
  TIMELINE_RIGHT_PADDING,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_UNIT_WIDTH,
  TIMELINE_STORY_TRACK_HEIGHT,
  TIMELINE_CHARACTER_HEADER_HEIGHT,
  TIMELINE_CHARACTER_SUBTRACK_HEIGHT,
  TIMELINE_NARRATIVE_TRACK_HEIGHT,
} from "@/components/TrackView/constants";
import { buildTimelineData } from "@/lib/utiils/timelineUtils";
import type { CharacterNodeData, WorkflowNode } from "@/lib/types/workflow";
import type { TimelineTrack } from "@/lib/types/timeline";

const getTrackUnitCount = (track: TimelineTrack | null) => {
  if (!track || track.items.length === 0) {
    return 0;
  }
  const maxPosition = Math.max(...track.items.map((item) => item.position));
  return maxPosition + 1;
};

export function TimelineView() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const {
    storyTrack,
    characterTracks,
    narrativeTrack,
    maxPosition,
    storyOutlineClusters,
    narrativeClusters,
  } = useMemo(() => buildTimelineData(nodes, edges), [nodes, edges]);

  // Cluster selection state (shared via uiStore, managed by page.tsx)
  const selectedStoryClusterId = useUiStore(
    (state) => state.selectedStoryClusterId,
  );
  const selectedNarrativeClusterId = useUiStore(
    (state) => state.selectedNarrativeClusterId,
  );

  // Map narrative groups to their connected perspective group IDs
  const narrativePerspectiveGroupMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    edges.forEach((edge) => {
      const sourceNode = nodesById.get(edge.source);
      const targetNode = nodesById.get(edge.target);

      if (
        sourceNode?.type === "perspectiveGroup" &&
        targetNode?.type === "narrativeGroup"
      ) {
        if (!map.has(targetNode.id)) {
          map.set(targetNode.id, new Set());
        }
        map.get(targetNode.id)?.add(sourceNode.id);
      }
    });

    return map;
  }, [nodes, edges]);

  // Get selected tracks
  const selectedStoryTrack = useMemo(() => {
    if (!selectedStoryClusterId) return storyTrack;
    const cluster = storyOutlineClusters.find(
      (c) => c.id === selectedStoryClusterId,
    );
    return cluster?.track || null;
  }, [selectedStoryClusterId, storyOutlineClusters, storyTrack]);

  const selectedNarrativeTrack = useMemo(() => {
    if (!selectedNarrativeClusterId) {
      // Return null when no cluster selected - hide track completely
      return null;
    }
    const cluster = narrativeClusters.find(
      (c) => c.id === selectedNarrativeClusterId,
    );
    return cluster?.track || null;
  }, [selectedNarrativeClusterId, narrativeClusters]);

  const snapToGrid = true;
  const storyUnits = getTrackUnitCount(selectedStoryTrack);
  const narrativeUnits = getTrackUnitCount(selectedNarrativeTrack);
  const filteredTimelineUnits = Math.max(storyUnits, narrativeUnits);
  const fallbackTimelineUnits = Math.max(maxPosition + 1, 1);
  const activeTimelineUnits =
    filteredTimelineUnits > 0 ? filteredTimelineUnits : fallbackTimelineUnits;
  const totalDuration = activeTimelineUnits;

  const timelineRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setContainerWidth(timelineRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate timeline width based on fixed spacing
  const timelineScale = TIMELINE_UNIT_WIDTH;
  const timelineUnits = Math.max(1, Math.ceil(activeTimelineUnits));
  const targetTimelineWidth =
    TIMELINE_LABEL_WIDTH +
    TIMELINE_LEFT_PADDING +
    TIMELINE_RIGHT_PADDING +
    timelineUnits * timelineScale;
  const timelineWidth = Math.max(containerWidth, targetTimelineWidth);

  // Convert time to pixel position
  const timeToPixel = useCallback(
    (time: number) => {
      return (
        TIMELINE_LABEL_WIDTH + TIMELINE_LEFT_PADDING + time * timelineScale
      );
    },
    [timelineScale],
  );

  // Convert pixel position to time
  const pixelToTime = useCallback(
    (pixel: number) => {
      return Math.max(
        0,
        (pixel - TIMELINE_LABEL_WIDTH - TIMELINE_LEFT_PADDING) / timelineScale,
      );
    },
    [timelineScale],
  );

  // Snap time to grid if enabled
  const snapTime = useCallback(
    (time: number) => {
      if (!snapToGrid) return time;
      return Math.round(time * 2) / 2; // Snap to half-unit grid
    },
    [snapToGrid],
  );

  // Filter character tracks based on connections between story and narrative clusters
  const filteredCharacterTracks = useMemo(() => {
    if (!selectedStoryClusterId || !selectedNarrativeClusterId) {
      // Return empty array - don't show tracks when no narrative cluster selected
      return [];
    }

    // Get event IDs from selected story cluster
    const selectedStoryCluster = storyOutlineClusters.find(
      (c) => c.id === selectedStoryClusterId,
    );
    const linkedPerspectiveGroups = narrativePerspectiveGroupMap.get(
      selectedNarrativeClusterId,
    );
    const storyTrackItems = selectedStoryCluster?.track.items ?? [];

    const perspectiveGroupCache = new Map<string, WorkflowNode[]>();
    const getOrderedPerspectivesForGroup = (groupId: string) => {
      if (perspectiveGroupCache.has(groupId)) {
        return perspectiveGroupCache.get(groupId)!;
      }
      const ordered = nodes
        .filter(
          (node): node is WorkflowNode =>
            node.type === "perspective" && node.parentId === groupId,
        )
        .sort(
          (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
        );
      perspectiveGroupCache.set(groupId, ordered);
      return ordered;
    };

    // Find perspectives that connect story events to narratives
    const validPerspectiveIds = new Set<string>();
    const perspectivePositionOverrides = new Map<string, number>();
    characterTracks.forEach((track) => {
      if (track.type !== "perspective") return;

      track.items.forEach((item) => {
        const perspectiveNode = nodes.find((n) => n.id === item.nodeId);

        // Check if this perspective is linked to the selected story cluster
        const parentGroupId = perspectiveNode?.parentId || "";
        if (!linkedPerspectiveGroups?.has(parentGroupId)) {
          return;
        }

        // Align by sibling order within the perspective group (index-based matching)
        const orderedPerspectives =
          getOrderedPerspectivesForGroup(parentGroupId);
        const siblingIndex = orderedPerspectives.findIndex(
          (node) => node.id === perspectiveNode?.id,
        );
        if (siblingIndex < 0 || storyTrackItems.length === 0) {
          return;
        }

        const targetEventItem =
          storyTrackItems[Math.min(siblingIndex, storyTrackItems.length - 1)];
        if (!targetEventItem) {
          return;
        }

        validPerspectiveIds.add(item.nodeId);
        perspectivePositionOverrides.set(item.nodeId, targetEventItem.position);
      });
    });

    // Filter character tracks - only return tracks with valid items
    const tracksWithItems: typeof characterTracks = [];

    characterTracks.forEach((track) => {
      if (track.type === "perspective") {
        // Filter perspective items that reference events in selected story cluster
        const filteredItems = track.items
          .filter((item) => validPerspectiveIds.has(item.nodeId))
          .map((item) => ({
            ...item,
            position:
              perspectivePositionOverrides.get(item.nodeId) ?? item.position,
          }));
        if (filteredItems.length > 0) {
          tracksWithItems.push({ ...track, items: filteredItems });
        }
      } else if (track.type === "character") {
        // Filter character items that reference valid perspectives
        const filteredItems = track.items
          .map((item) => {
            const characterNode = nodes.find((n) => n.id === item.nodeId);
            const characterData = characterNode?.data as
              | CharacterNodeData
              | undefined;
            if (
              !characterData?.perspectiveId ||
              !validPerspectiveIds.has(characterData.perspectiveId)
            ) {
              return null;
            }
            const overriddenPosition =
              perspectivePositionOverrides.get(characterData.perspectiveId) ??
              item.position;
            return { ...item, position: overriddenPosition };
          })
          .filter((item): item is (typeof track.items)[number] =>
            Boolean(item),
          );
        if (filteredItems.length > 0) {
          tracksWithItems.push({ ...track, items: filteredItems });
        }
      }
    });

    return tracksWithItems;
  }, [
    selectedStoryClusterId,
    selectedNarrativeClusterId,
    storyOutlineClusters,
    narrativeClusters,
    characterTracks,
    nodes,
    narrativePerspectiveGroupMap,
  ]);

  // Group filtered character tracks by stable parentTrackId (perspectiveGroup node ID)
  const groupedCharacterTracks = filteredCharacterTracks.reduce(
    (acc, track) => {
      const groupId = track.parentTrackId ?? track.characterName ?? "Unknown";
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(track);
      return acc;
    },
    {} as Record<string, typeof characterTracks>,
  );

  // Calculate total timeline height
  const totalTimelineHeight = useMemo(() => {
    let height = TIMELINE_RULER_HEIGHT;

    // Story track
    if (selectedStoryTrack) {
      height += TIMELINE_STORY_TRACK_HEIGHT;
    }

    // Character tracks (header + subtracks)
    Object.values(groupedCharacterTracks).forEach(() => {
      height += TIMELINE_CHARACTER_HEADER_HEIGHT;
      height += TIMELINE_CHARACTER_SUBTRACK_HEIGHT; // Perspective
      height += TIMELINE_CHARACTER_SUBTRACK_HEIGHT; // Character snapshot
    });

    // Narrative track - always add height when track exists
    if (selectedNarrativeTrack) {
      height += TIMELINE_NARRATIVE_TRACK_HEIGHT;
    }

    return height;
  }, [selectedStoryTrack, groupedCharacterTracks, selectedNarrativeTrack]);

  const footerStoryLabel = useMemo(() => {
    if (!selectedStoryClusterId) {
      return "All story clusters";
    }
    const cluster = storyOutlineClusters.find(
      (item) => item.id === selectedStoryClusterId,
    );
    if (!cluster) return "Story cluster";
    if (typeof cluster.eventGroupNumber === "number") {
      return `${cluster.label} ${cluster.eventGroupNumber}`;
    }
    return cluster.label;
  }, [selectedStoryClusterId, storyOutlineClusters]);

  const footerNarrativeLabel = useMemo(() => {
    if (!selectedNarrativeClusterId) {
      return "No narrative cluster";
    }
    const cluster = narrativeClusters.find(
      (item) => item.id === selectedNarrativeClusterId,
    );
    if (!cluster) return "Narrative cluster";
    if (typeof cluster.narrativeGroupNumber === "number") {
      return `${cluster.label} ${cluster.narrativeGroupNumber}`;
    }
    return cluster.label;
  }, [narrativeClusters, selectedNarrativeClusterId]);

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Timeline Container */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-auto bg-white timeline-container no-scrollbar"
        style={{
          width: "100%",
          cursor: "default",
        }}
      >
        <div
          className="relative h-full"
          style={{
            width: `${timelineWidth}px`,
            minHeight: "100%",
          }}
        >
          {/* Narrative Cluster Track - Above ruler */}
          {selectedNarrativeTrack && (
            <NarrativeTrack
              track={selectedNarrativeTrack}
              timeToPixel={timeToPixel}
              pixelToTime={pixelToTime}
              snapTime={snapTime}
              timelineScale={timelineScale}
            />
          )}

          {/* Time Ruler */}
          <TimelineRuler
            totalDuration={totalDuration}
            timeToPixel={timeToPixel}
            stickyTop={
              selectedNarrativeTrack ? TIMELINE_NARRATIVE_TRACK_HEIGHT : 0
            }
          />

          {/* Story Track */}
          {selectedStoryTrack && selectedStoryClusterId && (
            <EventTrack
              track={selectedStoryTrack}
              eventGroupId={selectedStoryClusterId}
              timeToPixel={timeToPixel}
              pixelToTime={pixelToTime}
              snapTime={snapTime}
              timelineScale={timelineScale}
            />
          )}

          {/* Character Perspective Tracks - Grouped by character */}
          {Object.entries(groupedCharacterTracks).map(([groupId, tracks]) => (
            <CharacterTrack
              key={groupId}
              characterName={tracks[0]?.characterName ?? "Unknown"}
              tracks={tracks}
              timeToPixel={timeToPixel}
              pixelToTime={pixelToTime}
              snapTime={snapTime}
              timelineScale={timelineScale}
            />
          ))}

          {/* Grid Lines */}
          <div
            className="absolute pointer-events-none"
            style={{
              top:
                (selectedNarrativeTrack ? TIMELINE_NARRATIVE_TRACK_HEIGHT : 0) +
                TIMELINE_RULER_HEIGHT,
              left: 0,
              right: 0,
              height: `${totalTimelineHeight - TIMELINE_RULER_HEIGHT - (selectedNarrativeTrack ? TIMELINE_NARRATIVE_TRACK_HEIGHT : 0)}px`,
            }}
          >
            {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 w-px bg-gray-300 opacity-30"
                style={{
                  left: `${timeToPixel(i)}px`,
                  height: "100%",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">{footerStoryLabel}</span>
          <span>•</span>
          <span>{footerNarrativeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{selectedStoryTrack?.items.length ?? 0} plots</span>
          <span>•</span>
          <span>{Object.keys(groupedCharacterTracks).length} characters</span>
          {/* <span>•</span>
          <span>{selectedNarrativeTrack?.items.length ?? 0} narratives</span> */}
        </div>
      </div>
    </div>
  );
}
