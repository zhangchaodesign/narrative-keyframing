"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TbFileText, TbPlayerPlay, TbTable } from "react-icons/tb";
import type { WorkflowNode } from "@/lib/types/workflow";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { useEditorStore } from "@/lib/stores/editorStore";
import { SlateUtils } from "@/lib/utiils/slateUtils";
import { NarrativeGenerationModal } from "@/components/shared/NarrativeGenerationModal";
import { NarrativeTableModal } from "@/components/shared/NarrativeTableModal";
import { cn } from "@/lib/utiils/sharedUtils";
import {
  buildNarrativeEventsData,
  combineNarrativeTextsInGroup,
  type NarrativeEventData,
} from "@/lib/utiils/narrativeUtils";

type NarrativeActionsMenuProps = {
  nodeId: string;
  wrapperClassName?: string;
  buttonPadding?: string;
  iconSize?: number;
  extraButtons?: ReactNode;
};

export function NarrativeActionsMenu({
  nodeId,
  wrapperClassName = "flex items-center gap-2",
  buttonPadding = "p-2",
  iconSize = 18,
  extraButtons,
}: NarrativeActionsMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const selectedSnippets = useWorkflowStore(
    (state) => state.selectedSnippets,
  );
  const { setValue } = useEditorStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [eventsData, setEventsData] = useState<NarrativeEventData[]>([]);
  const [preSelectedSnippets, setPreSelectedSnippets] = useState<Set<string>>(
    new Set(),
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleOpenModal = useCallback(() => {
    const preparedEventsData = buildNarrativeEventsData(nodeId, nodes, edges);
    if (preparedEventsData.length === 0) {
      alert("No narrative nodes found in this group");
      return;
    }

    const preSelected = new Set<string>();
    Object.values(selectedSnippets).forEach((snippet) => {
      preSelected.add(`${snippet.perspectiveNodeId}::${snippet.text}`);
    });

    setEventsData(preparedEventsData);
    setPreSelectedSnippets(preSelected);
    setIsModalOpen(true);
  }, [edges, nodeId, nodes, selectedSnippets]);

  const handleGenerateNarratives = useCallback(
    async (selectedSnippetKeys: Set<string>, customPrompt: string) => {
      setIsGenerating(true);
      setIsModalOpen(false);

      try {
        const filteredEventsData = eventsData.map((event) => ({
          ...event,
          snippets: event.snippets.filter((snippet) =>
            selectedSnippetKeys.has(
              `${snippet.perspectiveNodeId}::${snippet.text}`,
            ),
          ),
        }));

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

        const response = await fetch("/api/generate-narrative", {
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

        setNodes((nodesState) =>
          nodesState.map((node) => {
            if (node.type === "narrative" && node.parentId === nodeId) {
              const narrativeForNode = data.narratives?.find(
                (n: { narrativeNodeId: string }) =>
                  n.narrativeNodeId === node.id,
              );

              return {
                ...node,
                data: {
                  ...node.data,
                  narration:
                    narrativeForNode?.narration ??
                    node.data?.narration ??
                    "",
                  snippetUsages: narrativeForNode?.snippetUsages ?? [],
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

  const handleOpenTableModal = useCallback(() => {
    const preparedEventsData = buildNarrativeEventsData(nodeId, nodes, edges);
    if (preparedEventsData.length === 0) {
      alert("No narrative nodes found in this group");
      return;
    }
    setEventsData(preparedEventsData);
    setIsTableModalOpen(true);
  }, [edges, nodeId, nodes]);

  const handleCloseTableModal = useCallback(() => {
    setIsTableModalOpen(false);
  }, []);

  const handlePopulateEditor = useCallback(() => {
    const combinedText = combineNarrativeTextsInGroup(nodeId, nodes);

    if (combinedText.trim().length === 0) {
      return;
    }

    const slateValue = SlateUtils.textToSlateState(combinedText);
    setValue(slateValue);

    setNodes(
      (nodesState) =>
        nodesState.map((node) => {
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
  }, [nodeId, nodes, setNodes, setValue]);

  const Modals = useMemo(
    () => (
      <>
        <NarrativeGenerationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          isGenerating={isGenerating}
          onConfirm={handleGenerateNarratives}
          eventsData={eventsData}
          preSelectedSnippets={preSelectedSnippets}
        />
        <NarrativeTableModal
          isOpen={isTableModalOpen}
          onClose={handleCloseTableModal}
          eventsData={eventsData}
        />
      </>
    ),
    [
      eventsData,
      handleCloseModal,
      handleCloseTableModal,
      handleGenerateNarratives,
      isGenerating,
      isModalOpen,
      isTableModalOpen,
      preSelectedSnippets,
    ],
  );

  const baseButtonClass =
    "pointer-events-auto rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1";

  return (
    <>
      {Modals}
      <div className={cn(wrapperClassName)}>
        <button
          type="button"
          onClick={handleOpenModal}
          disabled={isGenerating}
          className={cn(
            baseButtonClass,
            buttonPadding,
            "hover:bg-green-50 hover:text-green-600 focus-visible:outline-green-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
          )}
          title="Generate third-person omniscient story from selected snippets"
          aria-label="Generate third-person omniscient story from selected snippets"
        >
          <TbPlayerPlay size={iconSize} />
        </button>
        <button
          type="button"
          onClick={handleOpenTableModal}
          className={cn(
            baseButtonClass,
            buttonPadding,
            "hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-purple-500 cursor-pointer",
          )}
          title="View narrative overview table"
          aria-label="View narrative overview table"
        >
          <TbTable size={iconSize} />
        </button>
        <button
          type="button"
          onClick={handlePopulateEditor}
          className={cn(
            baseButtonClass,
            buttonPadding,
            "hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-indigo-500 cursor-pointer",
          )}
          title="Populate text editor with narratives"
          aria-label="Populate text editor with narratives"
        >
          <TbFileText size={iconSize} />
        </button>
        {extraButtons}
      </div>
    </>
  );
}
