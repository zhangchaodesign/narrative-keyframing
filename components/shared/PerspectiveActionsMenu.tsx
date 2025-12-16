"use client";

import { useCallback, useMemo, useState } from "react";
import { TbListSearch, TbPlayerPlay } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import {
  generateMultiplePerspectives,
  analyzeMultiplePerspectivesEvidence,
  setPerspectivesLoading,
  setPerspectivesAnalyzing,
  applyGeneratedPerspectives,
  applyAnalysisResults,
} from "@/lib/utiils/perspectiveUtils";
import { cn } from "@/lib/utiils/sharedUtils";

type PerspectiveActionsMenuProps = {
  targetNodeIds: string[];
  label?: string;
  wrapperClassName?: string;
  buttonPadding?: string;
  iconSize?: number;
};

export function PerspectiveActionsMenu({
  targetNodeIds,
  label = "selected perspectives",
  wrapperClassName = "flex items-center gap-1",
  buttonPadding = "p-1",
  iconSize = 14,
}: PerspectiveActionsMenuProps) {
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const preparePerspectiveGeneration = useWorkflowStore(
    (state) => state.preparePerspectiveGeneration,
  );
  const getPerspectiveEvidenceTargets = useWorkflowStore(
    (state) => state.getPerspectiveEvidenceTargets,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const uniqueTargetIds = useMemo(
    () => Array.from(new Set(targetNodeIds)),
    [targetNodeIds],
  );

  const handleGeneratePerspectives = useCallback(async () => {
    if (isGenerating || uniqueTargetIds.length === 0) {
      return;
    }

    setIsGenerating(true);
    const targetIdSet = new Set(uniqueTargetIds);

    try {
      setNodes((currentNodes) =>
        setPerspectivesLoading(currentNodes, targetIdSet, true),
      );

      const preparation = preparePerspectiveGeneration(uniqueTargetIds);
      if (!preparation) {
        throw new Error("Unable to prepare generation payload");
      }

      const updateMap = await generateMultiplePerspectives(preparation);

      setNodes((currentNodes) =>
        applyGeneratedPerspectives(currentNodes, updateMap),
      );
    } catch (error) {
      console.error("Error generating perspectives:", error);
    } finally {
      setNodes((currentNodes) =>
        setPerspectivesLoading(currentNodes, targetIdSet, false),
      );
      setIsGenerating(false);
    }
  }, [isGenerating, preparePerspectiveGeneration, setNodes, uniqueTargetIds]);

  const handleAnalyzeAllEvidence = useCallback(async () => {
    if (isAnalyzing || uniqueTargetIds.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    const preparedTargets = getPerspectiveEvidenceTargets(uniqueTargetIds);
    const readyTargetIds = new Set(
      preparedTargets.map((target) => target.nodeId),
    );

    if (preparedTargets.length === 0) {
      setIsAnalyzing(false);
      return;
    }

    try {
      setNodes((currentNodes) =>
        setPerspectivesAnalyzing(currentNodes, readyTargetIds, true),
      );

      const results = await analyzeMultiplePerspectivesEvidence(
        preparedTargets,
      );

      setNodes((currentNodes) => applyAnalysisResults(currentNodes, results));
    } catch (error) {
      console.error("Error analyzing evidence for perspectives:", error);
      setNodes((currentNodes) =>
        setPerspectivesAnalyzing(currentNodes, readyTargetIds, false),
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [getPerspectiveEvidenceTargets, isAnalyzing, setNodes, uniqueTargetIds]);

  if (uniqueTargetIds.length === 0) {
    return null;
  }

  const generateTitle = `Generate first-person limited narration for ${label}`;
  const analyzeTitle = `Analyze textual evidence for ${label}`;

  return (
    <div className={cn(wrapperClassName)}>
      <button
        type="button"
        onClick={handleGeneratePerspectives}
        className={cn(
          "rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 hover:bg-green-50 hover:text-green-600 focus-visible:outline-green-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        title={generateTitle}
        aria-label={generateTitle}
        disabled={isGenerating}
      >
        <TbPlayerPlay size={iconSize} />
      </button>
      <button
        type="button"
        onClick={handleAnalyzeAllEvidence}
        className={cn(
          "rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        title={analyzeTitle}
        aria-label={analyzeTitle}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <span
            className="block animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-middle"
            style={{
              width: iconSize,
              height: iconSize,
            }}
          />
        ) : (
          <TbListSearch size={iconSize} />
        )}
      </button>
    </div>
  );
}
