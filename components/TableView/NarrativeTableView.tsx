"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { ThirdPersonGroupNodeType } from "@/lib/types/workflow";
import { generateNarratives } from "@/lib/utiils/narrativeUtils";
import { useUiStore } from "@/lib/stores/uiStore";
import { eventTracker } from "@/lib/utils";
import { NarrativeEventsTable } from "./NarrativeEventsTable";
import { NarrativePromptDialog } from "./NarrativePromptDialog";
import { NarrativeTableFooter } from "./NarrativeTableFooter";
import type { EventData } from "@/types/table";

type NarrativeTableViewProps = {
  groupId?: string;
};

export function NarrativeTableView({ groupId }: NarrativeTableViewProps) {
  const highlightEnabled = useUiStore((state) => state.narrativeTableHighlight);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [eventsData, setEventsData] = useState<EventData[]>([]);

  const setNodes = useWorkflowStore((state) => state.setNodes);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const toggleSnippet = useWorkflowStore((state) => state.toggleSnippet);
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const getNarrativeEventsData = useWorkflowStore(
    (state) => state.getNarrativeEventsData,
  );

  const narrativeTableGroupId = useUiStore(
    (state) => state.narrativeTableGroupId,
  );
  const narrativeGroups = useMemo(
    () =>
      nodes.filter(
        (node): node is ThirdPersonGroupNodeType =>
          node.type === "narrativeGroup",
      ),
    [nodes],
  );

  const formatNarrativeClusterLabel = useCallback(
    (group: ThirdPersonGroupNodeType) => {
      const label = group.data?.label?.trim() || "Narrative";
      if (typeof group.data?.narrativeGroupId === "number") {
        return `${label} ${group.data.narrativeGroupId}`;
      }
      return group.id ? `${label} (${group.id})` : label;
    },
    [],
  );

  const resolvedGroupId = useMemo(() => {
    if (groupId) {
      return groupId;
    }
    if (
      narrativeTableGroupId &&
      narrativeGroups.some((group) => group.id === narrativeTableGroupId)
    ) {
      return narrativeTableGroupId;
    }
    const activeGroup = narrativeGroups.find(
      (group) => group.data?.isActiveInEditor,
    );
    return activeGroup?.id ?? narrativeGroups[0]?.id;
  }, [groupId, narrativeGroups, narrativeTableGroupId]);

  const resolvedGroupLabel = useMemo(() => {
    const group = narrativeGroups.find((item) => item.id === resolvedGroupId);
    return group ? formatNarrativeClusterLabel(group) : "Narrative Overview";
  }, [formatNarrativeClusterLabel, narrativeGroups, resolvedGroupId]);

  const outlineLabel = useMemo(() => {
    const group = narrativeGroups.find((item) => item.id === resolvedGroupId);
    const connected = group?.data?.connectedEventGroup;
    if (!connected) return undefined;
    const label = connected.label?.trim() || "Plot Cluster";
    if (typeof connected.eventGroupId === "number") {
      return `${label} ${connected.eventGroupId}`;
    }
    return label;
  }, [narrativeGroups, resolvedGroupId]);

  const preparedEventsData = useMemo(() => {
    if (!resolvedGroupId) {
      return [];
    }
    return getNarrativeEventsData(resolvedGroupId);
  }, [getNarrativeEventsData, resolvedGroupId, nodes, edges]);

  useEffect(() => {
    setEventsData(preparedEventsData);
  }, [preparedEventsData]);

  const uniquePerspectives = useMemo(() => {
    const perspectivesMap = new Map<string, string>();
    eventsData.forEach((event) => {
      event.perspectives.forEach((perspective) => {
        const normalizedNarrator = perspective.narrator.trim().toLowerCase();
        if (!perspectivesMap.has(normalizedNarrator)) {
          perspectivesMap.set(normalizedNarrator, perspective.narrator);
        }
      });
    });
    return Array.from(perspectivesMap.values());
  }, [eventsData]);

  const snippetCounts = useMemo(() => {
    let total = 0;
    let selected = 0;
    eventsData.forEach((event) => {
      event.snippets.forEach((snippet) => {
        total += 1;
        const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
        if (selectedSnippets[key]) {
          selected += 1;
        }
      });
    });
    return { total, selected };
  }, [eventsData, selectedSnippets]);

  const handleRegenerateNarrative = async () => {
    if (isRegenerating) return;

    eventTracker({
      action: "regenerate_narrative_table_start",
      data: {
        narrativeGroupId: resolvedGroupId ?? null,
        eventCount: eventsData.length,
        selectedSnippetCount: snippetCounts.selected,
        customPrompt,
      },
    });

    setIsRegenerating(true);
    setShowPromptDialog(false);

    try {
      const filteredEventsData = eventsData.map((event) => ({
        ...event,
        snippets: event.snippets.filter((snippet) => {
          const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
          return Boolean(selectedSnippets[key]);
        }),
      }));

      const data = await generateNarratives({
        events: filteredEventsData,
        customPrompt,
        setNodes,
      });

      eventTracker({
        action: "regenerate_narrative_table_success",
        data: {
          narrativeGroupId: resolvedGroupId ?? null,
          eventCount: filteredEventsData.length,
        },
      });

      setEventsData((prevEventsData) =>
        prevEventsData.map((event) => {
          const narrativeForThisEvent = data.narratives?.find(
            (n) => n.narrativeNodeId === event.narrativeNodeId,
          );

          if (narrativeForThisEvent) {
            return {
              ...event,
              narration: narrativeForThisEvent.narration ?? event.narration,
              snippetUsages:
                narrativeForThisEvent.snippetUsages ??
                event.snippetUsages ??
                [],
            };
          }
          return event;
        }),
      );

      setCustomPrompt("");
    } catch (error) {
      console.error("Error regenerating narrative:", error);
      eventTracker({
        action: "regenerate_narrative_table_error",
        data: {
          narrativeGroupId: resolvedGroupId ?? null,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      alert("Failed to regenerate narrative. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleOpenRegenerateDialog = () => {
    eventTracker({
      action: "open_narrative_table_regenerate_dialog",
      data: {
        narrativeGroupId: resolvedGroupId ?? null,
        selectedSnippetCount: snippetCounts.selected,
        totalSnippetCount: snippetCounts.total,
      },
    });
    setShowPromptDialog(true);
  };

  const handleCancelDialog = () => {
    eventTracker({
      action: "cancel_narrative_table_regenerate_dialog",
      data: {
        promptLength: customPrompt.length,
      },
    });
    setShowPromptDialog(false);
    setCustomPrompt("");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-auto">
        <NarrativeEventsTable
          resolvedGroupId={resolvedGroupId}
          eventsData={eventsData}
          uniquePerspectives={uniquePerspectives}
          highlightEnabled={highlightEnabled}
          isRegenerating={isRegenerating}
          selectedSnippets={selectedSnippets}
          selectedEvidenceAttributes={selectedEvidenceAttributes}
          snippetCounts={snippetCounts}
          onOpenRegenerateDialog={handleOpenRegenerateDialog}
          toggleSnippet={toggleSnippet}
          toggleEvidenceAttribute={toggleEvidenceAttribute}
        />
      </div>

      <NarrativeTableFooter
        outlineLabel={outlineLabel}
        resolvedGroupLabel={resolvedGroupLabel}
        eventCount={eventsData.length}
        perspectiveCount={uniquePerspectives.length}
        selectedSnippetCount={snippetCounts.selected}
        totalSnippetCount={snippetCounts.total}
      />

      <NarrativePromptDialog
        isOpen={showPromptDialog}
        customPrompt={customPrompt}
        isRegenerating={isRegenerating}
        onChangePrompt={setCustomPrompt}
        onCancel={handleCancelDialog}
        onRegenerate={handleRegenerateNarrative}
      />
    </div>
  );
}
