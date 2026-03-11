"use client";

import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { TbHighlight, TbRefresh } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { SelectedSnippet } from "@/lib/stores/workflowStore";
import { cn, findTextMatches } from "@/lib/utiils/sharedUtils";
import { generateNarratives } from "@/lib/utiils/narrativeUtils";
import type { ThirdPersonGroupNodeType } from "@/lib/types/workflow";
import { useUiStore } from "@/lib/stores/uiStore";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import { eventTracker } from "@/lib/utils";

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

type NarrativeTableViewProps = {
  groupId?: string;
};

export function NarrativeTableView({ groupId }: NarrativeTableViewProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const getNarrativeEventsData = useWorkflowStore(
    (state) => state.getNarrativeEventsData,
  );
  const narrativeTableGroupId = useUiStore(
    (state) => state.narrativeTableGroupId,
  );
  const setNarrativeTableGroupId = useUiStore(
    (state) => state.setNarrativeTableGroupId,
  );
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const toggleSnippet = useWorkflowStore((state) => state.toggleSnippet);
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
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

  const preparedEventsData = useMemo(() => {
    if (!resolvedGroupId) {
      return [];
    }
    return getNarrativeEventsData(resolvedGroupId);
  }, [getNarrativeEventsData, resolvedGroupId, nodes, edges]);

  // Sync local eventsData with store changes
  useEffect(() => {
    setEventsData(preparedEventsData);
  }, [preparedEventsData]);

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
        customPrompt: customPrompt,
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

  // Helper function to highlight narrative snippetUsages (following NarrativeContent.tsx pattern)
  const highlightNarrative = (
    text: string,
    snippetUsages?: Array<{
      originalSnippet: string;
      verbatimInNarrative: string;
      narrator?: string;
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
      narrator?: string;
    };

    const ranges: HighlightRange[] = [];

    snippetUsages.forEach((usage) => {
      const matches = findTextMatches(text, usage.verbatimInNarrative);
      ranges.push(
        ...matches.map((match) => ({
          ...match,
          originalSnippet: usage.originalSnippet,
          narrator: usage.narrator,
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
        last.narrator = range.narrator;
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

      const highlightClass = range.narrator
        ? getCharacterColors(range.narrator).highlight
        : "bg-green-200";

      segments.push(
        <mark
          key={`segment-${index}-highlight`}
          className={`rounded ${highlightClass} px-0.5 py-0.5 text-gray-900`}
          title={`Based on: "${range.originalSnippet}"${range.narrator ? ` (${range.narrator})` : ""}`}
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

              eventTracker({
                action: isSelected
                  ? "deselect_narrative_table_snippet"
                  : "select_narrative_table_snippet",
                data: {
                  perspectiveNodeId: snippet.perspectiveNodeId,
                  characterId: snippet.characterId,
                  characterName: snippet.characterName ?? null,
                  snippetText: snippet.text,
                  attributes: snippet.attributes,
                },
              });

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
            const charColors = snippet.characterName
              ? getCharacterColors(snippet.characterName)
              : null;
            const selectedHighlight = charColors?.highlight ?? "bg-blue-400";
            const selectedBorder = charColors?.border ?? "border-blue-400";

            return (
              <mark
                key={index}
                onClick={handleClick}
                className={`cursor-pointer rounded px-0.5 py-0.5 transition-colors ${
                  isSelected
                    ? `${selectedHighlight} text-gray-900 border ${selectedBorder}`
                    : "bg-blue-100 text-gray-900 hover:bg-blue-300"
                }`}
                title={`Click to ${
                  isSelected ? "deselect" : "select"
                } snippet for story generation${snippet.characterName ? ` (${snippet.characterName})` : ""}`}
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

  const promptDialogContent = showPromptDialog && (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded bg-white p-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Custom Prompt (Optional)</legend>
          <textarea
            value={customPrompt}
            onChange={(e) => {
              const nextPrompt = e.target.value;
              setCustomPrompt(nextPrompt);
            }}
            placeholder="E.g., Focus on emotional depth, use vivid imagery..."
            rows={4}
            className="textarea w-full text-xs rounded"
          ></textarea>
        </fieldset>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => {
              eventTracker({
                action: "cancel_narrative_table_regenerate_dialog",
                data: {
                  promptLength: customPrompt.length,
                },
              });
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Narrative Overview - Table
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
              Narrative
            </span>
            <select
              value={resolvedGroupId ?? ""}
              onChange={(event) => {
                const nextGroupId = event.target.value
                  ? event.target.value
                  : undefined;
                const fromGroup =
                  narrativeGroups.find((group) => group.id === resolvedGroupId) ??
                  null;
                const toGroup =
                  narrativeGroups.find((group) => group.id === nextGroupId) ??
                  null;
                eventTracker({
                  action: "change_narrative_table_group",
                  data: {
                    from: fromGroup,
                    to: toGroup,
                    groupCount: narrativeGroups.length,
                  },
                });
                setNarrativeTableGroupId(nextGroupId);
              }}
              className="select select-sm select-bordered"
              disabled={narrativeGroups.length === 0}
            >
              {narrativeGroups.length === 0 ? (
                <option value="">No groups</option>
              ) : (
                narrativeGroups.map((group) => {
                  return (
                    <option key={group.id} value={group.id}>
                      {formatNarrativeClusterLabel(group)}
                    </option>
                  );
                })
              )}
            </select>
          </div>
          <button
            onClick={() => {
              eventTracker({
                action: highlightEnabled
                  ? "disable_narrative_table_highlighting"
                  : "enable_narrative_table_highlighting",
                data: {
                  narrativeGroupId: resolvedGroupId ?? null,
                },
              });
              setHighlightEnabled(!highlightEnabled);
            }}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${
              highlightEnabled
                ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {resolvedGroupId ? (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 min-w-[16rem] w-[16rem]">
                  Story Draft
                </th>
                {uniquePerspectives.map((narrator, index) => {
                  const charColors = getCharacterColors(narrator);
                  return (
                    <th
                      key={`narrator-${index}`}
                      className={`border border-gray-300 px-3 py-2 text-left font-semibold text-white ${charColors.bg}`}
                    >
                      <span
                        className={cn(
                          geistMono.className,
                          "rounded px-2 py-0.5 text-xs font-bold text-white text-center",
                          charColors.label,
                        )}
                      >
                        {narrator}
                      </span>
                    </th>
                  );
                })}
                <th className="border border-gray-300 bg-green-50 px-3 py-2 text-left font-semibold text-green-900 min-w-80 w-80">
                  <div className="flex items-center gap-1">
                    <span>Enriched Story</span>
                    <button
                      onClick={() => {
                        eventTracker({
                          action: "open_narrative_table_regenerate_dialog",
                          data: {
                            narrativeGroupId: resolvedGroupId ?? null,
                            selectedSnippetCount: snippetCounts.selected,
                            totalSnippetCount: snippetCounts.total,
                          },
                        });
                        setShowPromptDialog(true);
                      }}
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
                  <tr key={event.narrativeNodeId} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 align-top text-gray-700 text-xs">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          Event_{eventIndex + 1}
                        </div>
                        <div>
                          {event.eventDescription || (
                            <span className="text-gray-400 italic">
                              No description
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {uniquePerspectives.map((narrator, index) => {
                      const normalizedNarrator = narrator.trim().toLowerCase();
                      const reflection = perspectiveMap.get(normalizedNarrator);
                      const charColors = getCharacterColors(narrator);

                      return (
                        <td
                          key={`${event.narrativeNodeId}-persp-${index}`}
                          className={`border border-gray-300 px-3 py-2 align-top ${charColors.bg}`}
                        >
                          {reflection ? (
                            <div className="text-xs">
                              {highlightText(reflection, event.snippets)}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">
                              No perspective
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-3 py-2 align-top bg-green-50/30 min-w-80 w-80">
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
                        <span className="text-gray-400 italic text-xs">
                          No enriched story content
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No narrative groups available yet.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">{resolvedGroupLabel}</span>
          <span>•</span>
          <span>{eventsData.length} events</span>
          <span>•</span>
          <span>{uniquePerspectives.length} perspectives</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {snippetCounts.selected}/{snippetCounts.total} snippets selected
          </span>
        </div>
      </div>

      {promptDialogContent}
    </div>
  );
}
