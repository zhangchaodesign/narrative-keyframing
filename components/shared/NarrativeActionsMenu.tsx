"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TbFileText, TbPlayerPlay, TbTable } from "react-icons/tb";
import type { NarrativeEventData } from "@/lib/types/narrative";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { SlateUtils } from "@/lib/utiils/slateUtils";
import { NarrativeGenerationModal } from "@/components/shared/NarrativeGenerationModal";
import { cn } from "@/lib/utiils/sharedUtils";
import {
  combineNarrativeTextsInGroup,
  generateNarratives,
} from "@/lib/utiils/narrativeUtils";
import { eventTracker } from "@/lib/utils";

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
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const getNarrativeEventsData = useWorkflowStore(
    (state) => state.getNarrativeEventsData,
  );
  const { setValue } = useEditorStore();
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setNarrativeTableGroupId = useUiStore(
    (state) => state.setNarrativeTableGroupId,
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventsData, setEventsData] = useState<NarrativeEventData[]>([]);
  const [preSelectedSnippets, setPreSelectedSnippets] = useState<Set<string>>(
    new Set(),
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleOpenModal = useCallback(() => {
    const preparedEventsData = getNarrativeEventsData(nodeId);
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
  }, [getNarrativeEventsData, nodeId, selectedSnippets]);

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

        eventTracker({
          action: "generate_narratives",
          data: {
            narrativeGroupId: nodeId,
            snippetCount: selectedSnippetKeys.size,
            eventCount: filteredEventsData.length,
            customPrompt: customPrompt,
            events: filteredEventsData.map((event) => ({
              eventId: event.eventId,
              eventTimeline: event.eventTimeline,
              eventDescription: event.eventDescription,
              snippetCount: event.snippets.length,
              perspectiveCount: event.perspectives.length,
            })),
          },
        });

        console.log("Generating narratives for events:", filteredEventsData);

        await generateNarratives({
          events: filteredEventsData,
          customPrompt,
          setNodes,
        });
      } catch (error) {
        console.error("Error generating narrative:", error);
        alert("Failed to generate narrative. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [eventsData, nodeId, setNodes],
  );

  const handlePopulateEditor = useCallback(() => {
    const combinedText = combineNarrativeTextsInGroup(nodeId, nodes);

    if (combinedText.trim().length === 0) {
      return;
    }

    eventTracker({
      action: "populate_editor_from_narrative",
      data: {
        narrativeGroupId: nodeId,
        combinedText: combinedText,
      },
    });

    const slateValue = SlateUtils.textToSlateState(combinedText);
    setValue(slateValue);

    setNodes((nodesState) =>
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
      }),
    );
  }, [nodeId, nodes, setNodes, setValue]);

  const handleOpenTableView = useCallback(() => {
    const preparedEventsData = getNarrativeEventsData(nodeId);
    if (preparedEventsData.length === 0) {
      alert("No narrative nodes found in this group");
      return;
    }

    eventTracker({
      action: "open_narrative_table_view",
      data: {
        narrativeGroupId: nodeId,
        events: preparedEventsData.map((event) => ({
          narrativeNodeId: event.narrativeNodeId,
          eventId: event.eventId,
          eventTimeline: event.eventTimeline,
          eventDescription: event.eventDescription,
          narration: event.narration,
          perspectives: event.perspectives,
          snippets: event.snippets,
          snippetUsages: event.snippetUsages,
        })),
      },
    });

    setNarrativeTableGroupId(nodeId);
    setViewMode("narrative-table");
  }, [getNarrativeEventsData, nodeId, setNarrativeTableGroupId, setViewMode]);

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
      </>
    ),
    [
      eventsData,
      handleCloseModal,
      handleGenerateNarratives,
      isGenerating,
      isModalOpen,
      preSelectedSnippets,
    ],
  );

  const baseButtonClass =
    "pointer-events-auto rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1";
  const hasSelectedSnippets = Object.keys(selectedSnippets).length > 0;
  const hasNarrativeText =
    combineNarrativeTextsInGroup(nodeId, nodes).trim().length > 0;

  return (
    <>
      {Modals}
      <div className={cn(wrapperClassName)}>
        <button
          type="button"
          onClick={handleOpenModal}
          disabled={isGenerating || !hasSelectedSnippets}
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
          onClick={handleOpenTableView}
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
          disabled={!hasNarrativeText}
          className={cn(
            baseButtonClass,
            buttonPadding,
            "hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
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
