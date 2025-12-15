"use client";

import React from "react";
import type {
  NarrativeCluster,
  StoryOutlineCluster,
} from "@/lib/types/timeline";

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
  const hasNarrativeClusters = filteredNarrativeClusters.length > 0;

  const handleStoryClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    onStoryClusterChange(event.target.value);
  };

  const handleNarrativeClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    onNarrativeClusterChange(value || null);
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Timeline Overview
        </div>
        <div className="flex items-center gap-3">
          {hasStoryClusters && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="story-cluster-select"
                className="text-xs text-gray-600"
              >
                Story Outline:
              </label>
              <select
                id="story-cluster-select"
                value={selectedStoryClusterId || ""}
                onChange={handleStoryClusterChange}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {storyOutlineClusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.label}
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
                Narrative:
              </label>
              <select
                id="narrative-cluster-select"
                value={selectedNarrativeClusterId || ""}
                onChange={handleNarrativeClusterChange}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {filteredNarrativeClusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.label}
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
