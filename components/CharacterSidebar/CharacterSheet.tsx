"use client";

import React, { useCallback, useMemo, useState } from "react";
import { TbPencil, TbX } from "react-icons/tb";
import { type Character, useCharacterStore } from "@/lib/stores/characterStore";
import { AttributeEditor } from "./AttributeEditor";
import { AttributeStoryUpdateDialog } from "./AttributeStoryUpdateDialog";
import { ConfirmAttributeDeleteDialog } from "./ConfirmAttributeDeleteDialog";
import { useEditorStore } from "@/lib/stores/editorStore";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { TextUtils } from "@/lib/utils/textUtils";
import { type CharacterAttribute } from "@/lib/types/attributes";
import { type IndicatorType } from "@/lib/types/indicators";
import { diffWords, type Change } from "diff";

type PendingEvidenceMapping = {
  originalIndex: number;
  indicatorType: IndicatorType;
  text: string;
};

type PendingSentenceUpdate = {
  sentenceIndex: number;
  sentenceStart: number;
  originalSentence: string;
  originalLength: number;
  revisedSentence: string;
  rationale?: string;
  evidenceMappings: PendingEvidenceMapping[];
};

type PendingStoryUpdate = {
  suggestionId: string;
  originalStory: string;
  updatedStory: string;
  attributeCategory: string;
  attributeName: string;
  updates: PendingSentenceUpdate[];
};

type CharacterSheetProps = {
  character: Character;
  selectedAttribute: string | null;
  onAttributeClick: (attributeName: string) => void;
  enableEditing?: boolean;
};

export const CharacterSheet: React.FC<CharacterSheetProps> = React.memo(
  ({
    character,
    selectedAttribute,
    onAttributeClick,
    enableEditing = true,
  }) => {
    const {
      addAttributeToCharacter,
      renameAttributeForCharacter,
      removeAttributeFromCharacter,
      removeCharacter,
      removeSentenceData,
      shiftIndicesAfterSentenceChange,
      updateCharacterAttributes,
    } = useCharacterStore();
    const [pendingRename, setPendingRename] = useState<{
      category: string;
      originalName: string;
      snapshot: CharacterAttribute;
    } | null>(null);
    const [isProcessingRename, setIsProcessingRename] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);
    const [pendingStoryUpdate, setPendingStoryUpdate] =
      useState<PendingStoryUpdate | null>(null);
    const [storyUpdateError, setStoryUpdateError] = useState<string | null>(
      null,
    );
    const [isProcessingStoryUpdate, setIsProcessingStoryUpdate] =
      useState(false);
    const [pendingDelete, setPendingDelete] = useState<{
      category: string;
      name: string;
    } | null>(null);
    const [isProcessingDelete, setIsProcessingDelete] = useState(false);

    const grouped = useMemo(() => {
      const attrs = character?.attributes ?? [];
      return {
        physiology: attrs.filter((a) => a.category === "physiology"),
        psychology: attrs.filter((a) => a.category === "psychology"),
        sociology: attrs.filter((a) => a.category === "sociology"),
      };
    }, [character]);

    const handleAddAttribute = (category: string, value: string) => {
      addAttributeToCharacter(character.name, category, value);
    };

    const handleRemoveAttribute = (category: string, value: string) => {
      if (pendingStoryUpdate) {
        setStoryUpdateError(
          "Resolve the pending story update before deleting an attribute.",
        );
        return;
      }
      setStoryUpdateError(null);
      setPendingDelete({ category, name: value });
    };

    const handleRenameAttribute = (category: string, oldValue: string) => {
      if (pendingStoryUpdate) {
        setStoryUpdateError(
          "Resolve the pending story update before renaming another attribute.",
        );
        return;
      }

      const targetAttribute = character.attributes.find(
        (attr) => attr.category === category && attr.name === oldValue,
      );
      if (!targetAttribute) return;

      const snapshot = JSON.parse(
        JSON.stringify(targetAttribute),
      ) as CharacterAttribute;

      setRenameError(null);
      setPendingRename({
        category,
        originalName: oldValue,
        snapshot,
      });
    };

    const handleDeleteCharacter = () => {
      if (confirm(`Are you sure you want to delete ${character.name}?`)) {
        removeCharacter(character.name);
      }
    };

    const hasConflict = (attrName: string) =>
      character?.conflicts?.some(
        (conflict) => conflict.establishedAttribute.name === attrName,
      );

    const syncStoryWithAttribute = useCallback(
      async (snapshot: CharacterAttribute, newName: string) => {
        const editorStore = useEditorStore.getState();
        const existingSuggestion = editorStore.suggestion;
        if (existingSuggestion) {
          throw new Error(
            "Resolve the pending story suggestion before aligning another attribute.",
          );
        }

        const storyText = SlateUtils.stateToText(
          editorStore.value as any,
        ).trim();

        if (!storyText) {
          throw new Error(
            "Story text is empty. Add narrative content before syncing.",
          );
        }

        if (!snapshot.evidence || snapshot.evidence.length === 0) {
          throw new Error(
            "This attribute does not have any linked evidence to update.",
          );
        }

        const sentences = TextUtils.splitIntoSentences(storyText);
        const evidenceMap = new Map<
          number,
          {
            sentenceIndex: number;
            sentenceText: string;
            sentenceStart: number;
            originalLength: number;
            evidence: Array<{
              originalIndex: number;
              text: string;
              indicatorType: IndicatorType;
            }>;
          }
        >();

        snapshot.evidence.forEach((ev, evidenceIndex) => {
          const sentence = sentences[ev.sentenceIndex];
          if (!sentence) return;

          if (!evidenceMap.has(ev.sentenceIndex)) {
            evidenceMap.set(ev.sentenceIndex, {
              sentenceIndex: ev.sentenceIndex,
              sentenceText: sentence.text,
              sentenceStart: sentence.startIndex,
              originalLength: sentence.text.length,
              evidence: [],
            });
          }

          evidenceMap.get(ev.sentenceIndex)!.evidence.push({
            originalIndex: evidenceIndex,
            text: ev.text,
            indicatorType: ev.indicatorType,
          });
        });

        if (evidenceMap.size === 0) {
          throw new Error(
            "Unable to locate the supporting sentences in the story.",
          );
        }

        const evidenceEntries = Array.from(evidenceMap.values()).sort(
          (a, b) => a.sentenceIndex - b.sentenceIndex,
        );

        const response = await fetch("/api/story/align-attribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story: storyText,
            characterName: character.name,
            attributeCategory: snapshot.category,
            oldAttributeName: snapshot.name,
            newAttributeName: newName,
            evidenceSentences: evidenceEntries.map(
              ({ sentenceIndex, sentenceText, evidence }) => ({
                sentenceIndex,
                sentenceText,
                evidence: evidence.map((evidenceEntry) => ({
                  text: evidenceEntry.text,
                  indicatorType: evidenceEntry.indicatorType,
                })),
              }),
            ),
          }),
        });

        const responseData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));

        if (!response.ok) {
          throw new Error(
            responseData.error ||
              "Failed to align the story with the updated attribute.",
          );
        }

        const updates = Array.isArray(responseData.updates)
          ? responseData.updates
          : [];

        if (updates.length === 0) {
          throw new Error("The AI did not return any sentence updates.");
        }

        const updatesWithContext = updates
          .map((update: any) => {
            const context = evidenceMap.get(update.sentenceIndex);
            if (!context) return null;

            const revisedSentence = TextUtils.ensureSentenceTrailingSpace(
              String(update.revisedSentence || ""),
              context.sentenceText,
            );
            if (!revisedSentence.trim()) return null;

            const updatedEvidenceList: PendingEvidenceMapping[] = Array.isArray(
              update.updatedEvidence,
            )
              ? update.updatedEvidence
                  .map((evidenceEntry: unknown, evidenceIdx: number) => {
                    const base = context.evidence[evidenceIdx];
                    if (!base) return null;

                    const rawText =
                      typeof evidenceEntry === "string"
                        ? evidenceEntry
                        : (evidenceEntry as Record<string, unknown>)?.text;
                    const trimmedText = String(rawText || "").trim();
                    if (!trimmedText) return null;

                    return {
                      originalIndex: base.originalIndex,
                      indicatorType: base.indicatorType,
                      text: trimmedText,
                    };
                  })
                  .filter(
                    (
                      entry: {
                        originalIndex: number;
                        indicatorType: IndicatorType;
                        text: string;
                      } | null,
                    ): entry is {
                      originalIndex: number;
                      indicatorType: IndicatorType;
                      text: string;
                    } => Boolean(entry),
                  )
              : [];

            if (context.evidence.length !== updatedEvidenceList.length) {
              return null;
            }

            return {
              sentenceIndex: context.sentenceIndex,
              sentenceStart: context.sentenceStart,
              originalSentence: context.sentenceText,
              originalLength: context.originalLength,
              revisedSentence,
              rationale:
                typeof update.rationale === "string"
                  ? update.rationale
                  : undefined,
              evidenceMappings: updatedEvidenceList,
            };
          })
          .filter(
            (
              entry: {
                sentenceIndex: number;
                sentenceStart: number;
                originalSentence: string;
                originalLength: number;
                revisedSentence: string;
                rationale?: string;
                evidenceMappings: PendingEvidenceMapping[];
              } | null,
            ): entry is {
              sentenceIndex: number;
              sentenceStart: number;
              originalSentence: string;
              originalLength: number;
              revisedSentence: string;
              rationale?: string;
              evidenceMappings: PendingEvidenceMapping[];
            } => Boolean(entry),
          );

        if (updatesWithContext.length === 0) {
          throw new Error(
            "Unable to match AI revisions to the original sentences.",
          );
        }

        let updatedStory = storyText;
        for (const update of [...updatesWithContext].sort(
          (a, b) => b.sentenceStart - a.sentenceStart,
        )) {
          updatedStory =
            updatedStory.slice(0, update.sentenceStart) +
            update.revisedSentence +
            updatedStory.slice(
              update.sentenceStart + update.originalSentence.length,
            );
        }

        const diff = diffWords(storyText, updatedStory) as Change[];
        const diffSegments = diff.map((part) => ({
          text: part.value,
          added: Boolean(part.added),
          removed: Boolean(part.removed),
        }));

        const hasChange = diff.some((part) => part.added || part.removed);
        if (!hasChange) {
          throw new Error("Model did not suggest any meaningful changes.");
        }

        const suggestionId = `attribute-rename-${character.name}-${Date.now()}`;
        editorStore.beginSuggestion({
          conflictId: suggestionId,
          sentenceStart: 0,
          originalSentence: storyText,
          revisedSentence: updatedStory,
          sentenceIndex: -1,
          diffSegments,
        });

        return {
          suggestionId,
          originalStory: storyText,
          updatedStory,
          attributeCategory: snapshot.category,
          attributeName: newName,
          updates: updatesWithContext,
        } satisfies PendingStoryUpdate;
      },
      [character.name],
    );

    const handleRenameSubmit = async ({
      newName,
      updateStory,
    }: {
      newName: string;
      updateStory: boolean;
    }) => {
      if (!pendingRename) return;

      setRenameError(null);
      setStoryUpdateError(null);

      if (newName === pendingRename.originalName) {
        setPendingRename(null);
        return;
      }

      const duplicate = character.attributes.some(
        (attr) =>
          attr.category === pendingRename.category && attr.name === newName,
      );

      if (duplicate) {
        setRenameError("An attribute with that name already exists.");
        return;
      }

      if (pendingStoryUpdate) {
        setRenameError(
          "Resolve the pending story update before renaming another attribute.",
        );
        return;
      }

      setIsProcessingRename(true);

      try {
        let storyUpdate: PendingStoryUpdate | null = null;
        if (updateStory) {
          storyUpdate = await syncStoryWithAttribute(
            pendingRename.snapshot,
            newName,
          );
        }

        renameAttributeForCharacter(
          character.name,
          pendingRename.category,
          pendingRename.originalName,
          newName,
        );

        setPendingRename(null);

        if (storyUpdate) {
          setPendingStoryUpdate(storyUpdate);
        }
      } catch (error: unknown) {
        console.error(error);
        setRenameError(
          error instanceof Error
            ? error.message
            : "Failed to update story for the new attribute.",
        );
        useEditorStore.getState().clearSuggestion();
      } finally {
        setIsProcessingRename(false);
      }
    };

    const handleRejectStoryUpdate = () => {
      if (!pendingStoryUpdate) return;
      useEditorStore.getState().clearSuggestion();
      setPendingStoryUpdate(null);
      setStoryUpdateError(null);
    };

    const handleApproveStoryUpdate = async () => {
      if (!pendingStoryUpdate) return;

      setIsProcessingStoryUpdate(true);
      setStoryUpdateError(null);

      try {
        const characterState = useCharacterStore.getState();
        const latestCharacter = characterState.characters.find(
          (c) => c.name === character.name,
        );

        if (!latestCharacter) {
          throw new Error("Character could not be found.");
        }

        const finalSentences = TextUtils.splitIntoSentences(
          pendingStoryUpdate.updatedStory,
        );

        let failedEvidence = false;
        let attributeFound = false;

        const updatedAttributesList = latestCharacter.attributes.map((attr) => {
          if (
            attr.category === pendingStoryUpdate.attributeCategory &&
            attr.name === pendingStoryUpdate.attributeName
          ) {
            attributeFound = true;
            const updatedEvidence = [...attr.evidence];

            pendingStoryUpdate.updates.forEach((update) => {
              const finalSentence = finalSentences[update.sentenceIndex];
              if (!finalSentence) {
                failedEvidence = true;
                return;
              }

              const sentenceText = finalSentence.text;
              const usedRanges: Array<{ start: number; end: number }> = [];

              update.evidenceMappings.forEach((mapping) => {
                if (
                  mapping.originalIndex < 0 ||
                  mapping.originalIndex >= updatedEvidence.length
                ) {
                  failedEvidence = true;
                  return;
                }

                const searchText = mapping.text;
                if (!searchText) {
                  failedEvidence = true;
                  return;
                }

                let matchIndex = -1;
                let searchStart = 0;

                while (searchStart <= sentenceText.length) {
                  const idx = sentenceText.indexOf(searchText, searchStart);
                  if (idx === -1) break;

                  const overlaps = usedRanges.some(
                    (range) =>
                      idx < range.end && idx + searchText.length > range.start,
                  );
                  if (!overlaps) {
                    matchIndex = idx;
                    usedRanges.push({
                      start: idx,
                      end: idx + searchText.length,
                    });
                    break;
                  }
                  searchStart = idx + 1;
                }

                if (matchIndex === -1) {
                  failedEvidence = true;
                  return;
                }

                updatedEvidence[mapping.originalIndex] = {
                  text: searchText,
                  indicatorType: mapping.indicatorType,
                  sentenceIndex: update.sentenceIndex,
                };
              });
            });

            return {
              ...attr,
              evidence: updatedEvidence,
            };
          }
          return attr;
        });

        const cleanedAttributesList = updatedAttributesList.map((attr) => {
          const prunedEvidence = attr.evidence.filter((evidence) => {
            const trimmedText = evidence.text?.trim();
            if (!trimmedText) return false;
            const sentence = finalSentences[evidence.sentenceIndex];
            if (!sentence) return false;
            return (
              TextUtils.findAllMatches(sentence.text, trimmedText).length > 0
            );
          });

          if (prunedEvidence.length === attr.evidence.length) {
            return attr;
          }

          return {
            ...attr,
            evidence: prunedEvidence,
          };
        });

        if (!attributeFound) {
          throw new Error(
            "Updated attribute could not be located after rename.",
          );
        }

        if (failedEvidence) {
          throw new Error(
            "Unable to locate one or more evidence phrases in the revised sentences.",
          );
        }

        const editorState = useEditorStore.getState();
        if (
          !editorState.suggestion ||
          editorState.suggestion.conflictId !== pendingStoryUpdate.suggestionId
        ) {
          throw new Error(
            "Story suggestion is no longer available. Regenerate before applying.",
          );
        }

        editorState.applySuggestion();

        const sortedUpdates = [...pendingStoryUpdate.updates].sort(
          (a, b) => a.sentenceIndex - b.sentenceIndex,
        );

        let cumulativeDelta = 0;
        sortedUpdates.forEach((update) => {
          const adjustedStart = update.sentenceStart + cumulativeDelta;

          removeSentenceData(update.sentenceIndex);
          shiftIndicesAfterSentenceChange(
            update.sentenceIndex,
            adjustedStart,
            update.originalSentence.length,
            update.revisedSentence.length,
          );

          cumulativeDelta +=
            update.revisedSentence.length - update.originalSentence.length;
        });

        updateCharacterAttributes(character.name, cleanedAttributesList);

        setPendingStoryUpdate(null);
        setStoryUpdateError(null);
      } catch (error: unknown) {
        console.error(error);
        setStoryUpdateError(
          error instanceof Error
            ? error.message
            : "Failed to apply story updates.",
        );
      } finally {
        setIsProcessingStoryUpdate(false);
      }
    };

    const handleConfirmDelete = () => {
      if (!pendingDelete) return;
      setIsProcessingDelete(true);
      try {
        removeAttributeFromCharacter(
          character.name,
          pendingDelete.category,
          pendingDelete.name,
        );
        setPendingDelete(null);
      } finally {
        setIsProcessingDelete(false);
      }
    };

    // For AI-extracted characters with no attributes, show extraction prompt
    if (
      !character ||
      ((!character.attributes || character.attributes.length === 0) &&
        character.source === "ai-extracted" &&
        !enableEditing)
    ) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-600">
          No attributes extracted yet. Click "Analyze" to extract attributes.
        </div>
      );
    }

    const GroupBlock: React.FC<{
      title: string;
      titleClass: string;
      prefix: string;
      category: string;
      items: Array<{ name: string; evidence: any[] }>;
      selectedClass: string;
      idleClass: string;
    }> = ({
      title,
      titleClass,
      prefix,
      category,
      items,
      selectedClass,
      idleClass,
    }) => (
      <div>
        <h4 className={`text-xs font-semibold mb-2 uppercase ${titleClass}`}>
          {title}
        </h4>
        <div className="flex flex-wrap gap-2 items-center">
          {items.map((attr) => {
            const isSelected = selectedAttribute === attr.name;
            const conflict = hasConflict(attr.name);
            const base =
              "border px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring";
            const conflictClass = "bg-red-100 border-red-400 hover:bg-red-200";
            const stateClass = conflict
              ? conflictClass
              : isSelected
              ? selectedClass
              : idleClass;

            return (
              <div
                key={`${prefix}-${attr.name}`}
                className="relative inline-flex group"
              >
                <button
                  type="button"
                  className={`${base} ${stateClass} cursor-pointer`}
                  onClick={() => onAttributeClick(attr.name)}
                >
                  {conflict && "⚠️ "}
                  {attr.name} ({attr.evidence.length})
                </button>
                {enableEditing && (
                  <div className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      aria-label="Rename attribute"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRenameAttribute(category, attr.name);
                      }}
                      className="pointer-events-auto rounded bg-white/80 p-0.5 text-gray-500 shadow-sm hover:bg-white hover:text-gray-700 cursor-pointer"
                      title="Rename attribute"
                    >
                      <TbPencil size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove attribute"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveAttribute(category, attr.name);
                      }}
                      className="pointer-events-auto rounded bg-white/80 p-0.5 text-red-500 shadow-sm hover:bg-white hover:text-red-700  cursor-pointer"
                      title="Remove attribute"
                    >
                      <TbX size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {enableEditing && (
            <AttributeEditor
              onAdd={(value) => handleAddAttribute(category, value)}
              placeholder={`Add ${title.toLowerCase()}...`}
            />
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded shadow hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-gray-800">
            Attributes for {character.name}
          </h3>
          {enableEditing && character.source === "manual" && (
            <button
              type="button"
              onClick={handleDeleteCharacter}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
              title="Delete character"
            >
              Delete
            </button>
          )}
        </div>

        <GroupBlock
          title="Physiology"
          titleClass="text-blue-700"
          prefix="phys"
          category="physiology"
          items={grouped.physiology}
          selectedClass="bg-blue-200 font-bold ring-2 ring-blue-400 border-blue-300"
          idleClass="bg-blue-50 hover:bg-blue-100 border-blue-200"
        />

        <GroupBlock
          title="Psychology"
          titleClass="text-purple-700"
          prefix="psych"
          category="psychology"
          items={grouped.psychology}
          selectedClass="bg-purple-200 font-bold ring-2 ring-purple-400 border-purple-300"
          idleClass="bg-purple-50 hover:bg-purple-100 border-purple-200"
        />

        <GroupBlock
          title="Sociology"
          titleClass="text-green-700"
          prefix="soc"
          category="sociology"
          items={grouped.sociology}
          selectedClass="bg-green-200 font-bold ring-2 ring-green-400 border-green-300"
          idleClass="bg-green-50 hover:bg-green-100 border-green-200"
        />

        {selectedAttribute && (
          <div className="p-2 bg-white rounded text-xs">
            <p className="font-semibold mb-1">Evidence Types:</p>
            <p className="flex flex-wrap gap-1">
              <span className="indicator-direct px-1">Direct Definition</span>{" "}
              <span className="indicator-actions px-1">Actions</span>{" "}
              <span className="indicator-speech px-1">Speech</span>{" "}
              <span className="indicator-appearance px-1">Appearance</span>{" "}
              <span className="indicator-environment px-1">Environment</span>
            </p>
          </div>
        )}
        <AttributeStoryUpdateDialog
          isOpen={Boolean(pendingRename)}
          originalName={pendingRename?.originalName ?? ""}
          onCancel={() => {
            if (isProcessingRename) return;
            setPendingRename(null);
            setRenameError(null);
          }}
          onSubmit={handleRenameSubmit}
          isProcessing={isProcessingRename}
          error={renameError}
        />
        <ConfirmAttributeDeleteDialog
          isOpen={Boolean(pendingDelete)}
          attributeName={pendingDelete?.name ?? ""}
          onCancel={() => {
            if (isProcessingDelete) return;
            setPendingDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          isProcessing={isProcessingDelete}
        />
        {pendingStoryUpdate && (
          <div className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-900">
            <p className="text-[10px]">
              Suggested changes for "{pendingStoryUpdate.attributeName}" are
              highlighted in the editor. Approve to apply or discard to revert.
            </p>
            {storyUpdateError && (
              <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-600">
                {storyUpdateError}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleApproveStoryUpdate}
                disabled={isProcessingStoryUpdate}
                className="rounded bg-green-600 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-green-700 cursor-pointer"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={handleRejectStoryUpdate}
                disabled={isProcessingStoryUpdate}
                className="rounded bg-zinc-200 px-3 py-1 text-[10px] font-semibold text-zinc-800 transition hover:bg-zinc-300 cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);
