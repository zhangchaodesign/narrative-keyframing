"use client";

import React from "react";
import type {
  NarrativeCluster,
  StoryOutlineCluster,
} from "@/lib/types/timeline";
import { eventTracker } from "@/lib/utils";

interface TimelineHeaderProps {
  storyOutlineClusters: StoryOutlineCluster[];
  filteredNarrativeClusters: NarrativeCluster[];
  selectedStoryClusterId: string | null;
  onStoryClusterChange: (clusterId: string) => void;
  selectedNarrativeClusterId: string | null;
  onNarrativeClusterChange: (clusterId: string | null) => void;
}

export function TimelineHeader({
  storyOutlineClusters,
  filteredNarrativeClusters,
  selectedStoryClusterId,
  onStoryClusterChange,
  selectedNarrativeClusterId,
  onNarrativeClusterChange,
}: TimelineHeaderProps) {
  const hasStoryClusters = storyOutlineClusters.length > 0;
  const narrativeOptions = selectedStoryClusterId
    ? filteredNarrativeClusters.filter(
        (cluster) => cluster.linkedEventGroupId === selectedStoryClusterId,
      )
    : filteredNarrativeClusters;
  const hasNarrativeClusters = narrativeOptions.length > 0;

  const handleStoryClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextClusterId = event.target.value;
    eventTracker({
      action: "change_timeline_story_dropdown",
      data: {
        from: selectedStoryClusterId,
        to: nextClusterId,
        optionCount: storyOutlineClusters.length,
      },
    });
    onStoryClusterChange(nextClusterId);
  };

  const handleNarrativeClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    eventTracker({
      action: "change_timeline_narrative_dropdown",
      data: {
        from: selectedNarrativeClusterId,
        to: value || null,
        optionCount: narrativeOptions.length + 1, // Includes "None" option
      },
    });
    onNarrativeClusterChange(value || null);
  };

  const formatStoryClusterLabel = (cluster: StoryOutlineCluster) => {
    if (typeof cluster.eventGroupNumber === "number") {
      return `${cluster.label} ${cluster.eventGroupNumber}`;
    }
    if (cluster.eventGroupId) {
      return `${cluster.label} (${cluster.eventGroupId})`;
    }
    return cluster.label;
  };

  const formatNarrativeClusterLabel = (cluster: NarrativeCluster) => {
    if (typeof cluster.narrativeGroupNumber === "number") {
      return `${cluster.label} ${cluster.narrativeGroupNumber}`;
    }
    if (cluster.narrativeGroupId) {
      return `${cluster.label} (${cluster.narrativeGroupId})`;
    }
    return cluster.label;
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="px-6 py-3 flex items-center justify-between bg-white">
        <h2 className="text-lg font-semibold text-gray-900">
          Narrative Overview - Track
        </h2>
        <div className="flex items-center gap-3">
          {hasStoryClusters && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="story-cluster-select"
                className="text-xs text-gray-600 whitespace-nowrap"
              >
                Story Draft
              </label>
              <select
                id="story-cluster-select"
                value={selectedStoryClusterId || ""}
                onChange={handleStoryClusterChange}
                className="select select-sm select-bordered"
              >
                {storyOutlineClusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {formatStoryClusterLabel(cluster)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasNarrativeClusters && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="narrative-cluster-select"
                className="text-xs text-gray-600"
              >
                Narrative
              </label>
              <select
                id="narrative-cluster-select"
                value={selectedNarrativeClusterId || ""}
                onChange={handleNarrativeClusterChange}
                className="select select-sm select-bordered"
              >
                <option value="">None</option>
                {narrativeOptions.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {formatNarrativeClusterLabel(cluster)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
