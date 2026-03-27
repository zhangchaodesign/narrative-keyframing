"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { TbX } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { SelectedSnippet } from "@/lib/stores/workflowStore";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { eventTracker } from "@/lib/utils";

type EventData = {
  narrativeNodeId: string;
  eventId?: string;
  eventDescription: string;
  eventTimeline: string;
  snippets: SelectedSnippet[];
  perspectives: Array<{
    narrator: string;
    reflection: string;
  }>;
};

type NarrativeGenerationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedSnippets: Set<string>, customPrompt: string) => void;
  eventsData: EventData[];
  isGenerating: boolean;
  preSelectedSnippets: Set<string>;
};

export function NarrativeGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  eventsData,
  isGenerating,
  preSelectedSnippets,
}: NarrativeGenerationModalProps) {
  const [selectedSnippetKeys, setSelectedSnippetKeys] = useState<Set<string>>(
    new Set(),
  );
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeCharacterKey, setActiveCharacterKey] = useState<string>("");
  const toggleSnippetInStore = useWorkflowStore((state) => state.toggleSnippet);
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const nodes = useWorkflowStore((state) => state.nodes);
  const characterNamesById = useMemo(() => {
    const result: Record<string, string> = {};
    nodes.forEach((node) => {
      if (node.type === "character") {
        const trimmed = node.data?.name?.trim() ?? "";
        result[node.id] =
          trimmed.length > 0 ? trimmed : (node.data?.name ?? "");
      }
    });
    return result;
  }, [nodes]);

  // Group characters by normalized name so multiple snapshot IDs share the same tab
  const characterGroups = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; characterIds: Set<string> }
    >();

    eventsData.forEach((event) => {
      event.snippets.forEach((snippet) => {
        if (!snippet.characterId) {
          return;
        }

        const latestName =
          characterNamesById[snippet.characterId]?.trim() ||
          snippet.characterName?.trim() ||
          "";
        if (!latestName) {
          return;
        }

        const normalizedName = latestName.toLowerCase();
        if (!groups.has(normalizedName)) {
          groups.set(normalizedName, {
            name: latestName,
            characterIds: new Set(),
          });
        }
        groups.get(normalizedName)!.characterIds.add(snippet.characterId);
      });
    });

    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      name: value.name,
      characterIds: Array.from(value.characterIds),
    }));
  }, [eventsData, characterNamesById]);

  // Initialize only pre-selected snippets as selected when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedSnippetKeys(new Set(preSelectedSnippets));
  }, [isOpen, preSelectedSnippets]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (characterGroups.length === 0) {
      if (activeCharacterKey !== "") {
        setActiveCharacterKey("");
      }
      return;
    }

    const hasActiveCharacter = characterGroups.some(
      (character) => character.key === activeCharacterKey,
    );

    if (!hasActiveCharacter) {
      setActiveCharacterKey(characterGroups[0].key);
    }
  }, [isOpen, characterGroups, activeCharacterKey]);

  const toggleSnippet = (
    perspectiveNodeId: string,
    snippetText: string,
    snippet: SelectedSnippet,
  ) => {
    const key = `${perspectiveNodeId}::${snippetText}`;
    const isCurrentlySelected = selectedSnippetKeys.has(key);

    eventTracker({
      action: isCurrentlySelected
        ? "deselect_narrative_generation_snippet"
        : "select_narrative_generation_snippet",
      data: {
        perspectiveNodeId: snippet.perspectiveNodeId,
        characterId: snippet.characterId,
        characterName: snippet.characterName ?? null,
        snippetText: snippet.text,
        attributes: snippet.attributes ?? [],
      },
    });

    // Update local state
    setSelectedSnippetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Update global workflow store for snippet
    toggleSnippetInStore(snippet);

    // If selecting (not deselecting), also ensure all attributes are selected
    if (!isCurrentlySelected) {
      snippet.attributes.forEach((attribute) => {
        const attributeKey = `${snippet.characterId}::${attribute
          .trim()
          .toLowerCase()}`;
        // Only toggle if not already selected
        if (!selectedEvidenceAttributes[attributeKey]) {
          toggleEvidenceAttribute(snippet.characterId, attribute);
        }
      });
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedSnippetKeys, customPrompt);
  };

  const handleSelectAll = () => {
    const allSnippetKeys = new Set<string>();
    eventsData.forEach((event) => {
      event.snippets.forEach((snippet) => {
        allSnippetKeys.add(`${snippet.perspectiveNodeId}::${snippet.text}`);
      });
    });
    eventTracker({
      action: "select_all_snippets",
      data: {
        count: allSnippetKeys.size,
        eventCount: eventsData.length,
        allSnippet: Array.from(allSnippetKeys),
      },
    });
    setSelectedSnippetKeys(allSnippetKeys);
  };

  const handleDeselectAll = () => {
    eventTracker({
      action: "deselect_all_snippets",
      data: {
        previouslySelectedCount: selectedSnippetKeys.size,
      },
    });
    setSelectedSnippetKeys(new Set());
  };

  const handleTabChange = (characterKey: string) => {
    eventTracker({
      action: "switch_narrative_generation_character_tab",
      data: {
        fromCharacter: activeCharacterKey || null,
        toCharacter: characterKey,
      },
    });
    setActiveCharacterKey(characterKey);
  };

  const handleCustomPromptChange = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const nextPrompt = event.target.value;
    setCustomPrompt(nextPrompt);
  };

  const handleCloseWithTracking = (
    source: "close_button" | "cancel_button",
  ) => {
    eventTracker({
      action: "close_narrative_generation_modal",
      data: {
        source: source,
        selectedSnippetCount: selectedSnippetKeys.size,
        customPromptLength: customPrompt.length,
      },
    });
    onClose();
  };

  // Helper function to highlight selected evidence within reflection text
  const highlightReflection = (
    reflectionText: string,
    snippets: SelectedSnippet[],
  ) => {
    if (!reflectionText || snippets.length === 0) {
      return <>{reflectionText}</>;
    }

    // Get selected snippets for this event
    const selectedItems = snippets
      .filter((snippet) => {
        const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
        return selectedSnippetKeys.has(key);
      })
      .sort((a, b) => b.text.length - a.text.length); // Sort by length descending to match longer phrases first

    if (selectedItems.length === 0) {
      return <>{reflectionText}</>;
    }

    // Build a map from lowercase text to character highlight color
    const textToHighlight = new Map<string, string>();
    selectedItems.forEach((snippet) => {
      const highlightClass = snippet.characterName
        ? getCharacterColors(snippet.characterName).highlight
        : "bg-yellow-200";
      textToHighlight.set(snippet.text.toLowerCase(), highlightClass);
    });

    // Create a regex pattern to find all selected texts
    const pattern = selectedItems
      .map((s) => s.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    const parts = reflectionText.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const highlightClass = textToHighlight.get(part.toLowerCase());
          return highlightClass ? (
            <mark
              key={index}
              className={`${highlightClass} text-gray-900 font-medium rounded px-0.5`}
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </>
    );
  };

  // Filter events to show only active character's snippets and perspectives
  const filteredEventsData = useMemo(() => {
    if (!activeCharacterKey) return eventsData;

    const activeGroup = characterGroups.find(
      (group) => group.key === activeCharacterKey,
    );
    if (!activeGroup) {
      return eventsData;
    }

    const activeIds = new Set(activeGroup.characterIds);
    const normalizedName = activeGroup.name.toLowerCase();

    return eventsData.map((event) => ({
      ...event,
      snippets: event.snippets.filter((snippet) =>
        activeIds.has(snippet.characterId),
      ),
      perspectives: event.perspectives.filter(
        (perspective) =>
          perspective.narrator.trim().toLowerCase() === normalizedName,
      ),
    }));
  }, [eventsData, activeCharacterKey, characterGroups]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <h2 className="text font-semibold text-gray-900">
            Generate Third-Person Omniscient Narrative
          </h2>
          <button
            onClick={() => handleCloseWithTracking("close_button")}
            className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            <TbX size={20} />
          </button>
        </div>

        {/* Character Tabs */}
        {characterGroups.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50 px-6">
            <div className="flex gap-2 overflow-x-auto">
              {characterGroups.map((character) => {
                const tabColors = getCharacterColors(character.name);
                return (
                  <button
                    key={character.key}
                    onClick={() => handleTabChange(character.key)}
                    className={`whitespace-nowrap border-b-2 px-4 py-2 text-xs font-medium transition ${
                      activeCharacterKey === character.key
                        ? `${tabColors.border} ${tabColors.text}`
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
                    }`}
                  >
                    {character.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[calc(90vh-16rem)] overflow-y-auto px-6 py-4">
          {/* Events List */}
          <div className="space-y-6">
            {filteredEventsData.map((event, eventIndex) => (
              <div
                key={event.narrativeNodeId}
                className="rounded border border-gray-200 p-4"
              >
                {/* Event Header */}
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900">
                    Plot {eventIndex + 1}
                  </h3>
                  {event.eventDescription && (
                    <p className="mt-1 text-xs text-gray-600">
                      {event.eventDescription}
                    </p>
                  )}
                </div>

                {/* Perspectives */}
                {event.perspectives.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {event.perspectives.map((perspective, perspIndex) => (
                      <div
                        key={`${event.narrativeNodeId}-persp-${perspIndex}`}
                        className="rounded bg-gray-50 p-3"
                      >
                        <p className="text-xs font-medium text-gray-900">
                          {perspective.narrator}
                        </p>
                        {perspective.reflection && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                            {highlightReflection(
                              perspective.reflection,
                              event.snippets,
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Evidence/Snippets */}
                {event.snippets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-700">
                      Evidence ({event.snippets.length})
                    </h4>
                    {event.snippets.map((snippet, snippetIndex) => {
                      const snippetKey = `${snippet.perspectiveNodeId}::${snippet.text}`;
                      const isSelected = selectedSnippetKeys.has(snippetKey);

                      const snippetColors = snippet.characterName
                        ? getCharacterColors(snippet.characterName)
                        : null;
                      const selectedBg = snippetColors?.bg ?? "bg-green-50";
                      const selectedBorderClass =
                        snippetColors?.border ?? "border-green-300";

                      return (
                        <label
                          key={`${event.narrativeNodeId}-snippet-${snippetIndex}`}
                          className={`flex cursor-pointer items-center gap-3 rounded border p-3 transition ${
                            isSelected
                              ? `${selectedBorderClass} ${selectedBg}`
                              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleSnippet(
                                snippet.perspectiveNodeId,
                                snippet.text,
                                snippet,
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300 text-green-600"
                          />
                          <div className="flex-1">
                            <p className="text-xs text-gray-900">
                              "{snippet.text}"
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {snippet.attributes.map((attr, attrIndex) => (
                                <span
                                  key={`${snippetKey}-attr-${attrIndex}`}
                                  className={`rounded px-2 py-0.5 text-[10px] ${
                                    isSelected
                                      ? "bg-amber-200 text-amber-900"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {event.snippets.length === 0 && (
                  <p className="text-xs text-gray-400">
                    No evidence identified for this event
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Custom Prompt Input */}
          <fieldset className="fieldset mt-6">
            <legend className="fieldset-legend">
              Custom Prompt (Optional)
            </legend>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={handleCustomPromptChange}
              placeholder="Enter any additional instructions for narrative generation..."
              rows={4}
              className="textarea w-full text-xs rounded"
            ></textarea>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <button onClick={handleSelectAll} className="btn btn-sm btn-ghost">
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="btn btn-sm btn-ghost"
            >
              Deselect All
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleCloseWithTracking("cancel_button")}
              disabled={isGenerating}
              className="btn btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isGenerating || selectedSnippetKeys.size === 0}
              className="btn btn-sm btn-neutral"
            >
              {isGenerating ? "Generating..." : "Confirm & Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
