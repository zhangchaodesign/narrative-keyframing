"use client";

import { type ReactNode } from "react";
import { TbRefresh } from "react-icons/tb";
import { geistMono } from "@/app/fonts";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { cn, findTextMatches } from "@/lib/utiils/sharedUtils";
import { eventTracker } from "@/lib/utils";
import type { SelectedSnippet } from "@/lib/stores/workflowStore";
import type { EventData, NarrativeSnippet, SnippetUsage } from "@/types/table";

type NarrativeEventsTableProps = {
  resolvedGroupId?: string;
  eventsData: EventData[];
  uniquePerspectives: string[];
  highlightEnabled: boolean;
  isRegenerating: boolean;
  selectedSnippets: Record<string, SelectedSnippet>;
  selectedEvidenceAttributes: Record<string, boolean>;
  snippetCounts: { total: number; selected: number };
  onOpenRegenerateDialog: () => void;
  toggleSnippet: (snippet: SelectedSnippet) => void;
  toggleEvidenceAttribute: (characterId: string, attribute: string) => void;
};

type HighlightRange = {
  start: number;
  end: number;
  originalSnippet: string;
  narrator?: string;
};

function highlightNarrative(
  text: string,
  snippetUsages: SnippetUsage[] | undefined,
  highlightEnabled: boolean,
): ReactNode {
  if (
    !text ||
    !snippetUsages ||
    snippetUsages.length === 0 ||
    !highlightEnabled
  ) {
    return <>{text}</>;
  }

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
        className={`rounded px-0.5 py-0.5 text-gray-900 ${highlightClass}`}
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
}

function highlightReflection({
  text,
  snippets,
  highlightEnabled,
  selectedSnippets,
  selectedEvidenceAttributes,
  toggleSnippet,
  toggleEvidenceAttribute,
}: {
  text: string;
  snippets: NarrativeSnippet[];
  highlightEnabled: boolean;
  selectedSnippets: Record<string, SelectedSnippet>;
  selectedEvidenceAttributes: Record<string, boolean>;
  toggleSnippet: (snippet: SelectedSnippet) => void;
  toggleEvidenceAttribute: (characterId: string, attribute: string) => void;
}): ReactNode {
  if (!text || snippets.length === 0 || !highlightEnabled) {
    return <>{text}</>;
  }

  const sortedSnippets = [...snippets].sort(
    (a, b) => b.text.length - a.text.length,
  );
  if (sortedSnippets.length === 0) {
    return <>{text}</>;
  }

  const snippetMap = new Map<string, NarrativeSnippet>();
  sortedSnippets.forEach((snippet) =>
    snippetMap.set(snippet.text.toLowerCase(), snippet),
  );

  const pattern = sortedSnippets
    .map((snippet) => snippet.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const snippet = snippetMap.get(part.toLowerCase());
        if (!snippet) {
          return <span key={index}>{part}</span>;
        }

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

          toggleSnippet(snippetData);

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
                ? `${selectedHighlight} border text-gray-900 ${selectedBorder}`
                : "bg-blue-100 text-gray-900 hover:bg-blue-300"
            }`}
            title={`Click to ${
              isSelected ? "deselect" : "select"
            } snippet for story generation${snippet.characterName ? ` (${snippet.characterName})` : ""}`}
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}

export function NarrativeEventsTable({
  resolvedGroupId,
  eventsData,
  uniquePerspectives,
  highlightEnabled,
  isRegenerating,
  selectedSnippets,
  selectedEvidenceAttributes,
  snippetCounts,
  onOpenRegenerateDialog,
  toggleSnippet,
  toggleEvidenceAttribute,
}: NarrativeEventsTableProps) {
  if (!resolvedGroupId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        No narrative groups available yet.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 bg-gray-50">
        <tr>
          <th className="min-w-[16rem] w-[16rem] border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">
            Outline
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
                    "rounded px-2 py-0.5 text-center text-xs font-bold text-white",
                    charColors.label,
                  )}
                >
                  {narrator}
                </span>
              </th>
            );
          })}
          <th className="min-w-80 w-80 border border-gray-300 bg-green-50 px-3 py-2 text-left font-semibold text-green-900">
            <div className="flex items-center gap-1">
              <span>Story</span>
              <button
                onClick={onOpenRegenerateDialog}
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
            perspectiveMap.set(
              perspective.narrator.trim().toLowerCase(),
              perspective.reflection,
            );
          });

          return (
            <tr key={event.narrativeNodeId} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 align-top text-xs text-gray-700">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">
                    Act {eventIndex + 1}
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
                const reflection = perspectiveMap.get(
                  narrator.trim().toLowerCase(),
                );
                const charColors = getCharacterColors(narrator);

                return (
                  <td
                    key={`${event.narrativeNodeId}-persp-${index}`}
                    className={`border border-gray-300 px-3 py-2 align-top ${charColors.bg}`}
                  >
                    {reflection ? (
                      <div className="text-xs">
                        {highlightReflection({
                          text: reflection,
                          snippets: event.snippets,
                          highlightEnabled,
                          selectedSnippets,
                          selectedEvidenceAttributes,
                          toggleSnippet,
                          toggleEvidenceAttribute,
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        No perspective
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="min-w-80 w-80 border border-gray-300 bg-green-50/30 px-3 py-2 align-top">
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
                      highlightEnabled,
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    No enriched story content
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
