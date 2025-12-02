"use client";

import { useCallback, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { TbCopy, TbTrash, TbFileText, TbPlayerPlay } from "react-icons/tb";

import type {
  NarrativeNodeType,
  PerspectiveNodeType,
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  cloneData,
  deleteNodeCluster,
  generateUniqueUuidId,
} from "@/lib/workflow/workflowUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { SlateUtils } from "@/lib/slateUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeGenerationModal } from "./NarrativeGenerationModal";

type NarrativeGroupMenuProps = {
  nodeId: string;
};

type EventData = {
  narrativeNodeId: string;
  eventId?: string;
  eventDescription: string;
  eventTimeline: string;
  snippets: Array<{
    perspectiveNodeId: string;
    text: string;
    characterId: string;
    characterName: string;
    attributes: string[];
  }>;
  perspectives: Array<{
    narrator: string;
    reflection: string;
  }>;
};

const CLONE_OFFSET = 80;

export function NarrativeGroupMenu({ nodeId }: NarrativeGroupMenuProps) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const { setValue } = useEditorStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [preSelectedSnippets, setPreSelectedSnippets] = useState<Set<string>>(
    new Set(),
  );
  const nodes = useStore((store) => store.nodes);
  const edges = useStore((store) => store.edges);
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);

  const handleOpenModal = useCallback(() => {
    // Find all narrative nodes in this group
    const allNarrativeNodesInGroup = nodes.filter(
      (node) => node.type === "narrative" && node.parentId === nodeId,
    ) as NarrativeNodeType[];

    if (allNarrativeNodesInGroup.length === 0) {
      alert("No narrative nodes found in this group");
      return;
    }

    // Find perspective groups connected to this narrative group
    const connectedPerspectiveGroupIds = edges
      .filter((edge) => edge.target === nodeId)
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

    if (linkedPerspectiveNodes.length === 0) {
      alert("No perspective nodes found connected to this narrative group");
      return;
    }

    // Build events data with their associated snippets
    const preparedEventsData = allNarrativeNodesInGroup.map(
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

        // Extract all evidence from perspective nodes (regardless of selection)
        const snippetsForEvent: Array<{
          perspectiveNodeId: string;
          text: string;
          characterId: string;
          characterName: string;
          attributes: string[];
        }> = [];

        perspectiveNodesForEvent.forEach((pNode) => {
          const evidence = pNode.data?.analysisEvidence || [];
          evidence.forEach((evidenceItem) => {
            evidenceItem.items.forEach((item) => {
              snippetsForEvent.push({
                perspectiveNodeId: pNode.id,
                text: item.text,
                characterId: evidenceItem.characterId,
                characterName: evidenceItem.characterName,
                attributes: item.attributes,
              });
            });
          });
        });

        // Get reflection from all perspectiveNodesForEvent data
        const reflectionsForEvent = perspectiveNodesForEvent.map((pNode) => ({
          narrator: pNode.data?.narrator || "Unknown narrator",
          reflection: pNode.data?.reflection || "",
        }));

        return {
          narrativeNodeId: narrativeNodeInGroup.id,
          eventId,
          eventDescription,
          eventTimeline,
          snippets: snippetsForEvent,
          perspectives: reflectionsForEvent,
        };
      },
    );

    // Build set of pre-selected snippet keys from user's previous selections
    const preSelected = new Set<string>();
    Object.values(selectedSnippets).forEach((snippet) => {
      const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
      preSelected.add(key);
    });

    // Set events data, pre-selected snippets, and open modal
    setEventsData(preparedEventsData);
    setPreSelectedSnippets(preSelected);
    setIsModalOpen(true);
  }, [nodeId, nodes, edges, selectedSnippets]);

  const handleGenerateNarratives = useCallback(
    async (selectedSnippetKeys: Set<string>, customPrompt: string) => {
      setIsGenerating(true);
      setIsModalOpen(false);

      try {
        // Filter eventsData to only include selected snippets
        const filteredEventsData = eventsData.map((event) => ({
          ...event,
          snippets: event.snippets.filter((snippet) => {
            const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
            return selectedSnippetKeys.has(key);
          }),
        }));

        // Set loading state for all narrative nodes in the group
        setNodes((nodesState) =>
          nodesState.map((node) => {
            if (node.type === "narrative" && node.parentId === nodeId) {
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

        // Call the API with filtered events and custom prompt
        const response = await fetch("/api/narrative", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            events: filteredEventsData,
            customPrompt: customPrompt.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate narrative");
        }

        const data = await response.json();

        // Update all narrative nodes with their generated stories
        setNodes((nodesState) =>
          nodesState.map((node) => {
            if (node.type === "narrative" && node.parentId === nodeId) {
              const narrativeForThisNode = data.narratives?.find(
                (n: { narrativeNodeId: string }) =>
                  n.narrativeNodeId === node.id,
              );

              return {
                ...node,
                data: {
                  ...node.data,
                  narration:
                    narrativeForThisNode?.narration ??
                    node.data?.narration ??
                    "",
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
          nodesState.map((node) => {
            if (node.type === "narrative" && node.parentId === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  isLoading: false,
                },
              };
            }
            return node;
          }),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [eventsData, nodeId, setNodes],
  );

  const handleDelete = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const result = deleteNodeCluster(nodeId, nodes, edges);

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [getNodes, getEdges, nodeId, setEdges, setNodes]);

  const handlePopulateEditor = useCallback(() => {
    const currentNodes = getNodes();

    // Find all narrative nodes within this group
    const narrativeNodes = currentNodes.filter(
      (node): node is NarrativeNodeType =>
        node.type === "narrative" && node.parentId === nodeId,
    );

    if (narrativeNodes.length === 0) {
      return;
    }

    // Sort narrative nodes by their position (left to right, top to bottom)
    const sortedNarratives = narrativeNodes.sort((a, b) => {
      // Primary sort by y position (top to bottom)
      if (Math.abs(a.position.y - b.position.y) > 50) {
        return a.position.y - b.position.y;
      }
      // Secondary sort by x position (left to right)
      return a.position.x - b.position.x;
    });

    // Combine all narrative content with spacing
    const combinedText = sortedNarratives
      .map((node) => node.data?.narration || "")
      .filter((text) => text.trim().length > 0)
      .join("\n\n");

    if (combinedText.trim().length === 0) {
      return;
    }

    // Convert to Slate format and populate the editor
    const slateValue = SlateUtils.textToSlateState(combinedText);
    setValue(slateValue);

    // Update all narrative group nodes to mark this one as active
    setNodes(
      (nodes) =>
        nodes.map((node) => {
          if (node.type === "narrativeGroup") {
            return {
              ...node,
              data: {
                ...node.data,
                isActiveInEditor: node.id === nodeId,
              },
            };
          }
          return node;
        }) as WorkflowNode[],
    );
  }, [getNodes, nodeId, setValue, setNodes]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const groupNode = currentNodes.find(
      (node) => node.id === nodeId && node.type === "narrativeGroup",
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

    const newGroupId = generateUniqueUuidId("narration-group", existingNodeIds);
    existingNodeIds.add(newGroupId);
    idMap.set(nodeId, newGroupId);

    const newGroupNode: WorkflowNode = {
      ...groupNode,
      id: newGroupId,
      position: {
        x: groupNode.position.x + CLONE_OFFSET,
        y: groupNode.position.y + CLONE_OFFSET,
      },
      data: {
        ...cloneData(groupNode.data),
        isActiveInEditor: false,
      },
      selected: false,
      dragging: false,
    } as WorkflowNode;

    const newChildNodes: WorkflowNode[] = childNodes.map((original) => {
      const prefix =
        original.type === "narrative" ? "narrative" : original.type ?? "node";
      const newId = generateUniqueUuidId(prefix, existingNodeIds);
      existingNodeIds.add(newId);
      idMap.set(original.id, newId);

      return {
        ...original,
        id: newId,
        parentId: newGroupId,
        position: {
          x: original.position.x,
          y: original.position.y,
        },
        data: cloneData(original.data),
        selected: false,
        dragging: false,
      } as WorkflowNode;
    });

    const newNodes = [newGroupNode, ...newChildNodes];

    // Clone internal edges (edges between nodes within this cluster)
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

    // Clone incoming bridge edges from perspective groups
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

    setNodes((nodes) => [...nodes, ...newNodes]);
    setEdges((edges) => [...edges, ...newEdges, ...duplicatedBridges]);
  }, [getEdges, getNodes, nodeId, setEdges, setNodes]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <NarrativeGenerationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleGenerateNarratives}
        eventsData={eventsData}
        isGenerating={isGenerating}
        preSelectedSnippets={preSelectedSnippets}
      />
      <div className="pointer-events-none absolute -top-16 right-0 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          onClick={handleOpenModal}
          disabled={isGenerating}
          className="pointer-events-auto rounded-full p-2 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          title="Generate third-person omniscient story from selected snippets"
          aria-label="Generate third-person omniscient story from selected snippets"
        >
          <TbPlayerPlay size={18} />
        </button>
        <button
          type="button"
          onClick={handlePopulateEditor}
          className="pointer-events-auto rounded-full p-2 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
          title="Populate text editor with narratives"
          aria-label="Populate text editor with narratives"
        >
          <TbFileText size={18} />
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
    </>
  );
}
