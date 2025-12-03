"use client";

import { useMemo, useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TbX, TbHighlight, TbRefresh } from "react-icons/tb";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { SelectedSnippet } from "@/lib/stores/workflowStore";
import { findTextMatches } from "@/lib/utils";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types/workflow";

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
  narration?: string;
  snippetUsages?: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
  }>;
};

type NarrativeTableModalProps = {
  isOpen: boolean;
  onClose: () => void;
  eventsData: EventData[];
};

export function NarrativeTableModal({
  isOpen,
  onClose,
  eventsData: initialEventsData,
}: NarrativeTableModalProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [eventsData, setEventsData] = useState<EventData[]>(initialEventsData);
  const { setNodes } = useReactFlow<WorkflowNode, WorkflowEdge>();
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const toggleSnippet = useWorkflowStore((state) => state.toggleSnippet);
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );

  // Sync local eventsData with prop changes
  useEffect(() => {
    setEventsData(initialEventsData);
  }, [initialEventsData]);

  // Get unique perspectives across all events
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

  const handleRegenerateNarrative = async () => {
    if (isRegenerating) return;

    setIsRegenerating(true);
    setShowPromptDialog(false);

    try {
      // Filter eventsData to only include selected snippets
      const filteredEventsData = eventsData.map((event) => ({
        ...event,
        snippets: event.snippets.filter((snippet) => {
          const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
          return Boolean(selectedSnippets[key]);
        }),
      }));

      // Set loading state for all narrative nodes
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (
            node.type === "narrative" &&
            eventsData.some((e) => e.narrativeNodeId === node.id)
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
          if (node.type === "narrative") {
            const narrativeForThisNode = data.narratives?.find(
              (n: { narrativeNodeId: string }) => n.narrativeNodeId === node.id,
            );

            if (narrativeForThisNode) {
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
          }
          return node;
        }),
      );

      // Update eventsData state with new narratives to refresh the table
      setEventsData((prevEventsData) =>
        prevEventsData.map((event) => {
          const narrativeForThisEvent = data.narratives?.find(
            (n: { narrativeNodeId: string }) =>
              n.narrativeNodeId === event.narrativeNodeId,
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

      // Reset custom prompt
      setCustomPrompt("");
    } catch (error) {
      console.error("Error regenerating narrative:", error);
      alert("Failed to regenerate narrative. Please try again.");

      // Clear loading state on error
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (
            node.type === "narrative" &&
            eventsData.some((e) => e.narrativeNodeId === node.id)
          ) {
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
      setIsRegenerating(false);
    }
  };

  // Helper function to highlight narrative snippetUsages (following NarrativeContent.tsx pattern)
  const highlightNarrative = (
    text: string,
    snippetUsages?: Array<{
      originalSnippet: string;
      verbatimInNarrative: string;
    }>,
  ): ReactNode => {
    if (
      !text ||
      !snippetUsages ||
      snippetUsages.length === 0 ||
      !highlightEnabled
    ) {
      return <>{text}</>;
    }

    // Find all matching ranges in the narrative text
    type HighlightRange = {
      start: number;
      end: number;
      originalSnippet: string;
    };

    const ranges: HighlightRange[] = [];

    snippetUsages.forEach((usage) => {
      const matches = findTextMatches(text, usage.verbatimInNarrative);
      ranges.push(
        ...matches.map((match) => ({
          ...match,
          originalSnippet: usage.originalSnippet,
        })),
      );
    });

    if (ranges.length === 0) {
      return <>{text}</>;
    }

    // Sort and merge overlapping ranges
    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: HighlightRange[] = [];
    ranges.forEach((range) => {
      const last = merged[merged.length - 1];
      if (!last || range.start > last.end) {
        merged.push({ ...range });
      } else if (range.end > last.end) {
        last.end = range.end;
        last.originalSnippet = range.originalSnippet;
      }
    });

    // Generate segments with highlights
    const segments: ReactNode[] = [];
    let cursor = 0;

    merged.forEach((range, index) => {
      if (range.start > cursor) {
        segments.push(
          <span key={`segment-${index}-text`}>
            {text.slice(cursor, range.start)}
          </span>,
        );
      }

      segments.push(
        <mark
          key={`segment-${index}-highlight`}
          className="rounded bg-green-200 px-0.5 py-0.5 text-zinc-900"
          title={`Based on: "${range.originalSnippet}"`}
        >
          {text.slice(range.start, range.end)}
        </mark>,
      );
      cursor = range.end;
    });

    if (cursor < text.length) {
      segments.push(<span key="segment-tail">{text.slice(cursor)}</span>);
    }

    return <>{segments}</>;
  };

  // Helper function to highlight evidence snippets in perspectives
  const highlightText = (
    text: string,
    snippets: Array<{
      perspectiveNodeId: string;
      text: string;
      characterId: string;
      characterName: string;
      attributes: string[];
    }>,
  ) => {
    if (!text || snippets.length === 0 || !highlightEnabled) {
      return <>{text}</>;
    }

    // Sort snippets by length descending to match longer phrases first
    const sortedSnippets = [...snippets].sort(
      (a, b) => b.text.length - a.text.length,
    );

    if (sortedSnippets.length === 0) {
      return <>{text}</>;
    }

    // Create a map of snippet text to snippet data
    const snippetMap = new Map<string, (typeof snippets)[0]>();
    sortedSnippets.forEach((snippet) => {
      snippetMap.set(snippet.text.toLowerCase(), snippet);
    });

    // Create a regex pattern to find all snippet texts
    const pattern = sortedSnippets
      .map((snippet) => snippet.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const snippet = snippetMap.get(part.toLowerCase());
          if (snippet) {
            const snippetKey = `${snippet.perspectiveNodeId}::${snippet.text}`;
            const isSelected = Boolean(selectedSnippets[snippetKey]);

            const handleClick = () => {
              const snippetData: SelectedSnippet = {
                perspectiveNodeId: snippet.perspectiveNodeId,
                text: snippet.text,
                characterId: snippet.characterId,
                characterName: snippet.characterName,
                attributes: snippet.attributes,
              };

              // Toggle the snippet
              toggleSnippet(snippetData);

              // If selecting (not deselecting), also ensure all attributes are selected
              if (!isSelected) {
                snippet.attributes.forEach((attribute) => {
                  const attributeKey = `${snippet.characterId}::${attribute
                    .trim()
                    .toLowerCase()}`;
                  if (!selectedEvidenceAttributes[attributeKey]) {
                    toggleEvidenceAttribute(snippet.characterId, attribute);
                  }
                });
              }
            };

            // Following PerspectiveContent.tsx styling pattern
            return (
              <mark
                key={index}
                onClick={handleClick}
                className={`cursor-pointer rounded px-0.5 py-0.5 transition-colors ${
                  isSelected
                    ? "bg-blue-400 text-white ring-2 ring-blue-600"
                    : "bg-yellow-200 text-zinc-900 hover:bg-yellow-300"
                }`}
                title={`Click to ${
                  isSelected ? "deselect" : "select"
                } snippet for story generation`}
              >
                {part}
              </mark>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  if (!isOpen) return null;

  const promptDialogContent = showPromptDialog && (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded bg-white p-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Custom Prompt (Optional)</legend>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="E.g., Focus on emotional depth, use vivid imagery..."
            rows={4}
            className="textarea w-full text-xs rounded"
          ></textarea>
        </fieldset>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => {
              setShowPromptDialog(false);
              setCustomPrompt("");
            }}
            className="btn btn-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleRegenerateNarrative}
            disabled={isRegenerating}
            className="btn btn-sm btn-neutral"
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-7xl overflow-hidden rounded bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            Narrative Overview Table
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHighlightEnabled(!highlightEnabled)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${
                highlightEnabled
                  ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
              title={
                highlightEnabled
                  ? "Disable evidence highlighting"
                  : "Enable evidence highlighting"
              }
              aria-label={
                highlightEnabled
                  ? "Disable evidence highlighting"
                  : "Enable evidence highlighting"
              }
            >
              <TbHighlight size={16} />
              <span>
                {highlightEnabled ? "Highlighting On" : "Highlighting Off"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close modal"
            >
              <TbX size={20} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="max-h-[calc(90vh-5rem)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr>
                <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold text-zinc-700">
                  Event
                </th>
                <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold text-zinc-700">
                  Story Outline
                </th>
                {uniquePerspectives.map((narrator, index) => (
                  <th
                    key={`narrator-${index}`}
                    className="border border-zinc-300 bg-blue-50 px-3 py-2 text-left font-semibold text-blue-900"
                  >
                    {narrator}
                  </th>
                ))}
                <th className="border border-zinc-300 bg-green-50 px-3 py-2 text-left font-semibold text-green-900">
                  <div className="flex items-center gap-1">
                    <span>Narrative</span>
                    <button
                      onClick={() => setShowPromptDialog(true)}
                      disabled={isRegenerating}
                      className="rounded p-1 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Regenerate narratives"
                      aria-label="Regenerate narratives"
                    >
                      <TbRefresh
                        size={16}
                        className={isRegenerating ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {eventsData.map((event, eventIndex) => {
                // Create a map of narrator -> reflection for this event
                const perspectiveMap = new Map<string, string>();
                event.perspectives.forEach((perspective) => {
                  const normalizedNarrator = perspective.narrator
                    .trim()
                    .toLowerCase();
                  perspectiveMap.set(
                    normalizedNarrator,
                    perspective.reflection,
                  );
                });

                return (
                  <tr key={event.narrativeNodeId} className="hover:bg-zinc-50">
                    <td className="border border-zinc-300 px-3 py-2 align-top font-medium text-zinc-900 text-xs">
                      Event_{eventIndex + 1}
                    </td>
                    <td className="border border-zinc-300 px-3 py-2 align-top text-zinc-700 text-xs">
                      {event.eventDescription || (
                        <span className="text-zinc-400 italic">
                          No description
                        </span>
                      )}
                    </td>
                    {uniquePerspectives.map((narrator, index) => {
                      const normalizedNarrator = narrator.trim().toLowerCase();
                      const reflection = perspectiveMap.get(normalizedNarrator);

                      return (
                        <td
                          key={`${event.narrativeNodeId}-persp-${index}`}
                          className="border border-zinc-300 px-3 py-2 align-top bg-blue-50/30"
                        >
                          {reflection ? (
                            <div className="text-xs">
                              {highlightText(reflection, event.snippets)}
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic text-xs">
                              No perspective
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-zinc-300 px-3 py-2 align-top bg-green-50/30">
                      {isRegenerating ? (
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <TbRefresh size={14} className="animate-spin" />
                          <span>Regenerating...</span>
                        </div>
                      ) : event.narration ? (
                        <div className="text-xs">
                          {highlightNarrative(
                            event.narration,
                            event.snippetUsages,
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">
                          No narrative
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      {promptDialogContent && createPortal(promptDialogContent, document.body)}
    </>
  );
}
