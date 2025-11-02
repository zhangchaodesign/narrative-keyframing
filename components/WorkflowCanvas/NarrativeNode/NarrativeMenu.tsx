"use client";

import { useCallback, useState } from "react";
import { TbPlayerPlay } from "react-icons/tb";
import { useReactFlow, useStore } from "@xyflow/react";
import {
  useWorkflowStore,
  type SelectedSnippet,
} from "@/lib/stores/workflowStore";
import type {
  NarrativeNodeType,
  PerspectiveNodeType,
  EventNodeType,
} from "@/lib/types/workflow";

type NarrativeMenuProps = {
  nodeId: string;
};

export function NarrativeMenu({ nodeId }: NarrativeMenuProps) {
  const { setNodes } = useReactFlow();
  const nodes = useStore((store) => store.nodes);
  const edges = useStore((store) => store.edges);
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRun = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Find the current narrative node
      const narrativeNode = nodes.find(
        (node) => node.id === nodeId && node.type === "narrative",
      ) as NarrativeNodeType | undefined;

      if (!narrativeNode) {
        console.error("Narrative node not found");
        return;
      }

      // Get the narrative node's parent group
      const narrativeParentGroupId = narrativeNode.parentId;

      if (!narrativeParentGroupId) {
        alert("Narrative node must be in a narrative group");
        return;
      }

      // Find all narrative nodes in the same group
      const allNarrativeNodesInGroup = nodes.filter(
        (node) =>
          node.type === "narrative" && node.parentId === narrativeParentGroupId,
      ) as NarrativeNodeType[];

      // Find perspective groups connected to the narrative group
      const connectedPerspectiveGroupIds = edges
        .filter((edge) => edge.target === narrativeParentGroupId)
        .map((edge) => edge.source)
        .filter((sourceId) => {
          const sourceNode = nodes.find((n) => n.id === sourceId);
          return sourceNode?.type === "perspectiveGroup";
        });

      // Find all perspective nodes within those groups
      const linkedPerspectiveNodes = nodes.filter(
        (node) =>
          node.type === "perspective" &&
          node.parentId &&
          connectedPerspectiveGroupIds.includes(node.parentId),
      ) as PerspectiveNodeType[];

      // Get all selected snippets from linked perspective nodes
      const allRelevantSnippets = Object.values(selectedSnippets).filter(
        (snippet) =>
          linkedPerspectiveNodes.some(
            (pNode) => pNode.id === snippet.perspectiveNodeId,
          ),
      );

      if (allRelevantSnippets.length === 0) {
        alert(
          "Please select at least one snippet from the linked perspective nodes by clicking on highlighted text.",
        );
        return;
      }

      // Build events data with their associated snippets
      const eventsData = allNarrativeNodesInGroup.map(
        (narrativeNodeInGroup) => {
          const eventId = narrativeNodeInGroup.data?.eventId;
          let eventDescription = "";
          let eventTimeline = "";

          if (eventId) {
            const eventNode = nodes.find(
              (node) => node.id === eventId && node.type === "event",
            ) as EventNodeType | undefined;

            if (eventNode) {
              eventDescription = eventNode.data?.description ?? "";
              eventTimeline = eventNode.data?.timeline ?? "";
            }
          }

          // Find perspective nodes with matching eventId
          const perspectiveNodesForEvent = linkedPerspectiveNodes.filter(
            (pNode) => pNode.data?.eventId === eventId,
          );

          // Get snippets from those perspective nodes
          const snippetsForEvent = allRelevantSnippets.filter((snippet) =>
            perspectiveNodesForEvent.some(
              (pNode) => pNode.id === snippet.perspectiveNodeId,
            ),
          );

          return {
            narrativeNodeId: narrativeNodeInGroup.id,
            eventId,
            eventDescription,
            eventTimeline,
            snippets: snippetsForEvent,
          };
        },
      );

      // Check if at least one event has snippets
      const hasAnySnippets = eventsData.some(
        (event) => event.snippets.length > 0,
      );

      if (!hasAnySnippets) {
        alert(
          "Please select at least one snippet from any event to generate the story.",
        );
        return;
      }

      // Set loading state for all narrative nodes in the group
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (
            node.type === "narrative" &&
            node.parentId === narrativeParentGroupId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                isLoading: true,
              },
            };
          }
          return node;
        }),
      );

      // Call the API with all events (including those without snippets)
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events: eventsData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate narrative");
      }

      const data = await response.json();

      // Update all narrative nodes with their generated stories
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (
            node.type === "narrative" &&
            node.parentId === narrativeParentGroupId
          ) {
            const narrativeForThisNode = data.narratives?.find(
              (n: { narrativeNodeId: string }) => n.narrativeNodeId === node.id,
            );

            return {
              ...node,
              data: {
                ...node.data,
                narration:
                  narrativeForThisNode?.narration ?? node.data?.narration ?? "",
                snippetUsages: narrativeForThisNode?.snippetUsages ?? [],
                isLoading: false,
              },
            };
          }
          return node;
        }),
      );
    } catch (error) {
      console.error("Error generating narrative:", error);
      alert("Failed to generate narrative. Please try again.");

      // Clear loading state on error
      setNodes((nodesState) =>
        nodesState.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  isLoading: false,
                },
              }
            : node,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }, [nodeId, nodes, edges, selectedSnippets, setNodes]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRun}
        disabled={isGenerating}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        title="Generate third-person omniscient story from selected snippets"
        aria-label="Generate third-person omniscient story from selected snippets"
      >
        <TbPlayerPlay size={12} />
      </button>
    </div>
  );
}
