"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TbX } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { SelectedSnippet } from "@/lib/stores/workflowStore";

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
        result[node.id] = trimmed.length > 0 ? trimmed : node.data?.name ?? "";
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
    setSelectedSnippetKeys(allSnippetKeys);
  };

  const handleDeselectAll = () => {
    setSelectedSnippetKeys(new Set());
  };

  // Helper function to highlight selected evidence within reflection text
  const highlightReflection = (
    reflectionText: string,
    snippets: Array<{ perspectiveNodeId: string; text: string }>,
  ) => {
    if (!reflectionText || snippets.length === 0) {
      return <>{reflectionText}</>;
    }

    // Get selected snippets for this event
    const selectedTexts = snippets
      .filter((snippet) => {
        const key = `${snippet.perspectiveNodeId}::${snippet.text}`;
        return selectedSnippetKeys.has(key);
      })
      .map((snippet) => snippet.text)
      .sort((a, b) => b.length - a.length); // Sort by length descending to match longer phrases first

    if (selectedTexts.length === 0) {
      return <>{reflectionText}</>;
    }

    // Create a regex pattern to find all selected texts
    const pattern = selectedTexts
      .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    const parts = reflectionText.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const isHighlighted = selectedTexts.some(
            (text) => text.toLowerCase() === part.toLowerCase(),
          );
          return isHighlighted ? (
            <mark
              key={index}
              className="bg-yellow-200 text-blue-900 font-medium"
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
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <h2 className="text font-semibold text-zinc-900">
            Generate Third-Person Omniscient Narrative
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close modal"
          >
            <TbX size={20} />
          </button>
        </div>

        {/* Character Tabs */}
        {characterGroups.length > 0 && (
          <div className="border-b border-zinc-200 bg-zinc-50 px-6">
            <div className="flex gap-2 overflow-x-auto">
              {characterGroups.map((character) => (
                <button
                  key={character.key}
                  onClick={() => setActiveCharacterKey(character.key)}
                  className={`whitespace-nowrap border-b-2 px-4 py-2 text-xs font-medium transition ${
                    activeCharacterKey === character.key
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                >
                  {character.name}
                </button>
              ))}
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
                className="rounded border border-zinc-200 p-4"
              >
                {/* Event Header */}
                <div className="mb-3">
                  <h3 className="font-semibold text-zinc-900">
                    Event {eventIndex + 1}
                  </h3>
                  {event.eventDescription && (
                    <p className="mt-1 text-xs text-zinc-600">
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
                        className="rounded bg-blue-50 p-3"
                      >
                        <p className="text-xs font-medium text-blue-900">
                          {perspective.narrator}
                        </p>
                        {perspective.reflection && (
                          <p className="mt-1 text-xs text-blue-700">
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
                    <h4 className="text-xs font-medium text-zinc-700">
                      Evidence ({event.snippets.length})
                    </h4>
                    {event.snippets.map((snippet, snippetIndex) => {
                      const snippetKey = `${snippet.perspectiveNodeId}::${snippet.text}`;
                      const isSelected = selectedSnippetKeys.has(snippetKey);

                      return (
                        <label
                          key={`${event.narrativeNodeId}-snippet-${snippetIndex}`}
                          className={`flex cursor-pointer items-center gap-3 rounded border p-3 transition ${
                            isSelected
                              ? "border-green-300 bg-green-50"
                              : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
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
                            className="h-4 w-4 rounded border-zinc-300 text-green-600"
                          />
                          <div className="flex-1">
                            <p className="text-xs text-zinc-900">
                              "{snippet.text}"
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {snippet.attributes.map((attr, attrIndex) => (
                                <span
                                  key={`${snippetKey}-attr-${attrIndex}`}
                                  className={`rounded px-2 py-0.5 text-[10px] ${
                                    isSelected
                                      ? "bg-amber-200 text-amber-900"
                                      : "bg-zinc-200 text-zinc-700"
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
                  <p className="text-xs text-zinc-400">
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
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter any additional instructions for narrative generation..."
              rows={4}
              className="textarea w-full text-xs rounded"
            ></textarea>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
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
              onClick={onClose}
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
