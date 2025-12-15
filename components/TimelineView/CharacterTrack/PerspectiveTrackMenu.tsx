"use client";

import { useCallback, useState } from "react";
import { TbPlayerPlay, TbListSearch } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import {
  generateMultiplePerspectives,
  analyzeMultiplePerspectivesEvidence,
  setPerspectivesLoading,
  setPerspectivesAnalyzing,
  applyGeneratedPerspectives,
  applyAnalysisResults,
} from "@/lib/workflow/perspectiveActions";

type PerspectiveTrackMenuProps = {
  characterName: string;
  perspectiveItems: Array<{ id: string; nodeId: string }>;
};

export function PerspectiveTrackMenu({
  characterName,
  perspectiveItems,
}: PerspectiveTrackMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleGeneratePerspectives = useCallback(async () => {
    if (isGenerating || perspectiveItems.length === 0) {
      return;
    }

    const targetNodeIds = perspectiveItems.map((item) => item.nodeId);

    setIsGenerating(true);

    try {
      // Set loading state
      setNodes((currentNodes) =>
        setPerspectivesLoading(currentNodes, new Set(targetNodeIds), true),
      );

      // Generate perspectives
      const updateMap = await generateMultiplePerspectives(
        targetNodeIds,
        nodes,
        edges,
      );

      // Apply generated perspectives
      setNodes((currentNodes) =>
        applyGeneratedPerspectives(currentNodes, updateMap),
      );
    } catch (error) {
      console.error("Error generating perspectives:", error);
    } finally {
      // Clear loading state
      setNodes((currentNodes) =>
        setPerspectivesLoading(currentNodes, new Set(targetNodeIds), false),
      );
      setIsGenerating(false);
    }
  }, [isGenerating, nodes, edges, setNodes, perspectiveItems]);

  const handleAnalyzeAllEvidence = useCallback(async () => {
    if (isAnalyzing || perspectiveItems.length === 0) {
      return;
    }

    const targetNodeIds = perspectiveItems.map((item) => item.nodeId);
    setIsAnalyzing(true);

    try {
      // Set analyzing state
      setNodes((currentNodes) =>
        setPerspectivesAnalyzing(currentNodes, new Set(targetNodeIds), true),
      );

      // Analyze evidence for all perspectives
      const results = await analyzeMultiplePerspectivesEvidence(
        targetNodeIds,
        nodes,
        edges,
      );

      // Apply analysis results
      setNodes((currentNodes) => applyAnalysisResults(currentNodes, results));
    } catch (error) {
      console.error("Error analyzing evidence for track:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, nodes, edges, setNodes, perspectiveItems]);

  if (perspectiveItems.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 ml-2">
      <button
        type="button"
        onClick={handleGeneratePerspectives}
        className="rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        title={`Generate first-person limited narration for all ${characterName} perspectives`}
        aria-label={`Generate first-person limited narration for all ${characterName} perspectives`}
        disabled={isGenerating}
      >
        <TbPlayerPlay size={14} />
      </button>
      <button
        type="button"
        onClick={handleAnalyzeAllEvidence}
        className="rounded-full p-1 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        title={`Analyze textual evidence for all ${characterName} perspectives`}
        aria-label={`Analyze textual evidence for all ${characterName} perspectives`}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-middle" />
        ) : (
          <TbListSearch size={14} />
        )}
      </button>
    </div>
  );
}
