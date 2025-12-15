"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbTrash, TbPlayerPlay, TbListSearch } from "react-icons/tb";

import type {
  WorkflowEdge,
  WorkflowNode,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import {
  cloneData,
  deleteNodeCluster,
  generateUniqueUuidId,
} from "@/lib/utiils/workflowUtils";
import {
  generateMultiplePerspectives,
  analyzeMultiplePerspectivesEvidence,
  setPerspectivesLoading,
  setPerspectivesAnalyzing,
  applyGeneratedPerspectives,
  applyAnalysisResults,
} from "@/lib/utiils/perspectiveUtils";

type PerspectiveGroupMenuProps = {
  nodeId: string;
};

const CLONE_OFFSET = 80;

export function PerspectiveGroupMenu({ nodeId }: PerspectiveGroupMenuProps) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleGeneratePerspectives = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    const nodes = getNodes();
    const edges = getEdges();

    // Get all perspective nodes in this group
    const perspectiveNodesInGroup = nodes.filter(
      (node) => node.type === "perspective" && node.parentId === nodeId,
    );

    if (perspectiveNodesInGroup.length === 0) {
      return;
    }

    const targetNodeIds = perspectiveNodesInGroup.map((node) => node.id);

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
  }, [isGenerating, getNodes, getEdges, setNodes, nodeId]);

  const handleAnalyzeAllEvidence = useCallback(async () => {
    if (isAnalyzing) {
      return;
    }

    const nodes = getNodes();
    const edges = getEdges();

    // Get all perspective nodes in this group
    const perspectiveNodesInGroup = nodes.filter(
      (node) => node.type === "perspective" && node.parentId === nodeId,
    );

    if (perspectiveNodesInGroup.length === 0) {
      return;
    }

    const targetNodeIds = perspectiveNodesInGroup.map((node) => node.id);

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
      console.error("Error analyzing evidence for group:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, getNodes, getEdges, setNodes, nodeId]);

  const handleDelete = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const result = deleteNodeCluster(nodeId, nodes, edges);

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [getNodes, getEdges, nodeId, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const groupNode = currentNodes.find(
      (node) => node.id === nodeId && node.type === "perspectiveGroup",
    );

    if (!groupNode) {
      return;
    }

    const childNodes = currentNodes.filter((node) => node.parentId === nodeId);
    const clusterNodeIds = new Set<string>([
      nodeId,
      ...childNodes.map((n) => n.id),
    ]);

    const existingNodeIds = new Set(currentNodes.map((node) => node.id));
    const existingEdgeIds = new Set(currentEdges.map((edge) => edge.id));
    const idMap = new Map<string, string>();

    const newGroupId = generateUniqueUuidId(
      "perspective-group",
      existingNodeIds,
    );
    existingNodeIds.add(newGroupId);
    idMap.set(nodeId, newGroupId);

    const newGroupNode: WorkflowNode = {
      ...groupNode,
      id: newGroupId,
      position: {
        x: groupNode.position.x + CLONE_OFFSET,
        y: groupNode.position.y + CLONE_OFFSET,
      },
      data: cloneData(groupNode.data),
      selected: false,
      dragging: false,
    } as WorkflowNode;

    // First pass: Generate new IDs for all child nodes and build the complete ID map
    const childNodesWithNewIds = childNodes.map((original) => {
      const prefix =
        original.type === "perspective"
          ? "perspective"
          : original.type === "character"
          ? "character"
          : original.type ?? "node";
      const newId = generateUniqueUuidId(prefix, existingNodeIds);
      existingNodeIds.add(newId);
      idMap.set(original.id, newId);
      return { original, newId };
    });

    // Second pass: Create new nodes with updated data, now that all IDs are mapped
    const newChildNodes: WorkflowNode[] = childNodesWithNewIds.map(
      ({ original, newId }) => {
        let clonedData = cloneData(original.data);

        // Update analysisEvidence characterId references for perspective nodes
        if (original.type === "perspective") {
          const perspectiveData = original.data as PerspectiveNodeType["data"];
          if (
            perspectiveData?.analysisEvidence &&
            perspectiveData.analysisEvidence.length > 0
          ) {
            clonedData = {
              ...clonedData,
              analysisEvidence: perspectiveData.analysisEvidence.map(
                (evidence) => {
                  // Map old character ID to new character ID using the complete idMap
                  const newCharacterId =
                    idMap.get(evidence.characterId) ?? evidence.characterId;
                  return {
                    characterId: newCharacterId,
                    characterName: evidence.characterName,
                    items: evidence.items.map((item) => ({
                      text: item.text,
                      category: item.category,
                      attributes: [...item.attributes],
                    })),
                  };
                },
              ),
            };
          }
        }

        return {
          ...original,
          id: newId,
          parentId: newGroupId,
          position: {
            x: original.position.x,
            y: original.position.y,
          },
          data: clonedData,
          selected: false,
          dragging: false,
        } as WorkflowNode;
      },
    );

    const newNodes = [newGroupNode, ...newChildNodes];

    const internalEdges = currentEdges.filter(
      (edge) =>
        clusterNodeIds.has(edge.source) && clusterNodeIds.has(edge.target),
    );

    const newEdges = internalEdges.map((edge) => {
      const newId = generateUniqueUuidId("edge", existingEdgeIds);
      existingEdgeIds.add(newId);

      return {
        ...edge,
        id: newId,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        data: cloneData(edge.data),
        selected: false,
      };
    });

    const bridgingEdges = currentEdges.filter(
      (edge) => edge.target === nodeId && edge.targetHandle === "group-bridge",
    );

    const duplicatedBridges = bridgingEdges.map((edge) => {
      const newId = generateUniqueUuidId("edge", existingEdgeIds);
      existingEdgeIds.add(newId);
      return {
        ...edge,
        id: newId,
        target: newGroupId,
        data: cloneData(edge.data),
        selected: false,
      };
    });

    const fallbackBridge: WorkflowEdge[] = [];
    if (duplicatedBridges.length === 0) {
      const eventGroupNode = currentNodes.find(
        (node) => node.type === "eventGroup",
      );
      if (eventGroupNode) {
        const newId = generateUniqueUuidId("edge", existingEdgeIds);
        existingEdgeIds.add(newId);
        fallbackBridge.push({
          id: newId,
          source: eventGroupNode.id,
          target: newGroupId,
          sourceHandle: "group-bridge",
          targetHandle: "group-bridge",
          type: "customEdge",
          animated: true,
        });
      }
    }

    setNodes((nodes) => [...nodes, ...newNodes]);
    setEdges((edges) => [
      ...edges,
      ...newEdges,
      ...duplicatedBridges,
      ...fallbackBridge,
    ]);
  }, [getEdges, getNodes, nodeId, setEdges, setNodes]);

  return (
    <div className="pointer-events-none absolute -top-16 right-0 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleGeneratePerspectives}
        className="pointer-events-auto rounded-full p-2 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        title="Generate first-person limited narration for all perspectives"
        aria-label="Generate first-person limited narration for all perspectives"
        disabled={isGenerating}
      >
        <TbPlayerPlay size={18} />
      </button>
      <button
        type="button"
        onClick={handleAnalyzeAllEvidence}
        className="pointer-events-auto rounded-full p-2 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        title="Analyze textual evidence for all perspectives in this group"
        aria-label="Analyze textual evidence for all perspectives in this group"
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-middle" />
        ) : (
          <TbListSearch size={18} />
        )}
      </button>
      <button
        type="button"
        onClick={handleDuplicate}
        className="pointer-events-auto rounded-full p-2 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
        title="Duplicate cluster"
        aria-label="Duplicate cluster"
      >
        <TbCopy size={18} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="pointer-events-auto rounded-full p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer"
        title="Delete cluster"
        aria-label="Delete cluster"
      >
        <TbTrash size={18} />
      </button>
    </div>
  );
}
