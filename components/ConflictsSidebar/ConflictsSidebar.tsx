"use client";

import { ConflictCard } from "@/components/ConflictsSidebar/ConflictCard";
import { type Character, useCharacterStore } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";
import { useEditorStore } from "@/lib/stores/editorStore";
import { CoreferenceUtils } from "@/lib/utils/coreferenceUtils";
import { TextUtils } from "@/lib/utils/textUtils";
import { SlateUtils } from "@/lib/utils/slateUtils";
import React, { useCallback, useMemo, useState } from "react";

interface ConflictsSidebarProps {
  /** ✅ multi-select */
  selectedCharacters: string[];
  characters: Character[];
  selectedConflictId: string | null;
  onConflictClick: (conflict: AttributeConflict) => void;
  onResolveConflict?: (
    characterName: string,
    conflictId: string,
    decision: "approved" | "rejected",
  ) => void;
}

export function ConflictsSidebar({
  selectedCharacters,
  characters,
  selectedConflictId,
  onConflictClick,
  onResolveConflict,
}: ConflictsSidebarProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const { selectedList, totalConflicts } = useMemo(() => {
    const selectedSet = new Set(selectedCharacters);
    const sel = characters.filter((c) => selectedSet.has(c.name));
    const total = sel.reduce(
      (sum, c) => sum + (c.conflicts ? c.conflicts.length : 0),
      0,
    );
    return { selectedList: sel, totalConflicts: total };
  }, [selectedCharacters, characters]);

  const handleDetectConflicts = useCallback(async () => {
    if (isDetecting) return;

    setIsDetecting(true);
    try {
      const editorState = useEditorStore.getState();
      const story = SlateUtils.stateToText(editorState.value as any);

      if (!story || story.trim().length === 0) {
        alert("Add story text before running conflict detection.");
        return;
      }

      const sentences = TextUtils.splitIntoSentences(story);
      if (sentences.length === 0) {
        alert("Unable to split story into sentences.");
        return;
      }

      const detectionTasks: Array<
        Promise<{ characterName: string; conflicts: AttributeConflict[] }>
      > = [];

      for (
        let sentenceIndex = 0;
        sentenceIndex < sentences.length;
        sentenceIndex++
      ) {
        const sentence = sentences[sentenceIndex];
        if (!sentence.text.trim()) continue;

        for (const character of characters) {
          const attributes = character.attributes ?? [];
          if (attributes.length === 0) continue;

          const hasMatches = (character.coreferenceMatches ?? []).length > 0;
          const mentionedInSentence = hasMatches
            ? character.coreferenceMatches.some(
                (match) => match.sentenceIndex === sentenceIndex,
              )
            : true;

          if (!mentionedInSentence) continue;

          detectionTasks.push(
            CoreferenceUtils.detectSentenceConflicts(
              character.name,
              sentence.text,
              sentenceIndex,
              sentence.startIndex,
              attributes,
            )
              .then((conflicts) => ({
                characterName: character.name,
                conflicts,
              }))
              .catch((error) => {
                console.error(
                  `Failed detecting conflicts for ${character.name} in sentence ${sentenceIndex}`,
                  error,
                );
                return { characterName: character.name, conflicts: [] };
              }),
          );
        }
      }

      const conflictsByCharacter = new Map<string, AttributeConflict[]>();

      if (detectionTasks.length > 0) {
        const results = await Promise.all(detectionTasks);

        for (const { characterName, conflicts } of results) {
          if (!conflicts || conflicts.length === 0) continue;

          const existing = conflictsByCharacter.get(characterName) ?? [];
          const merged = [...existing];

          for (const conflict of conflicts) {
            const isDuplicate = merged.some(
              (existingConflict) =>
                existingConflict.establishedAttribute.name ===
                  conflict.establishedAttribute.name &&
                existingConflict.category === conflict.category &&
                existingConflict.conflictingEvidence.startIndex ===
                  conflict.conflictingEvidence.startIndex &&
                existingConflict.conflictingEvidence.endIndex ===
                  conflict.conflictingEvidence.endIndex,
            );

            if (!isDuplicate) {
              merged.push(conflict);
            }
          }

          conflictsByCharacter.set(characterName, merged);
        }
      }

      const { updateCharacterConflicts } = useCharacterStore.getState();

      characters.forEach((character) => {
        const conflicts = conflictsByCharacter.get(character.name) ?? [];
        updateCharacterConflicts(character.name, conflicts);
      });

      if (
        Array.from(conflictsByCharacter.values()).every(
          (list) => list.length === 0,
        )
      ) {
        alert("No conflicts detected.");
      }
    } catch (error) {
      console.error("Failed to detect conflicts", error);
      alert("Failed to detect conflicts. Check the console for details.");
    } finally {
      setIsDetecting(false);
    }
  }, [characters, isDetecting]);

  // Always render the sidebar to maintain layout
  return (
    <div className="w-80 relative flex-shrink-0">
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 p-4 z-10 backdrop-blur border border-zinc-100 rounded select-none bg-zinc-50">
          <h3 className="text-lg font-bold text-red-700">
            ⚠️ Conflicts
            {typeof totalConflicts === "number" ? ` (${totalConflicts})` : ""}
          </h3>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Click a conflict to highlight evidence
          </p>
          <button
            type="button"
            onClick={handleDetectConflicts}
            className="w-full rounded btn btn-secondary btn-sm"
            disabled={isDetecting}
          >
            {isDetecting ? "Detecting…" : "Detect Conflicts"}
          </button>
        </div>

        {/* Nothing selected or no conflicts */}
        {selectedList.length === 0 || totalConflicts === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            {selectedList.length === 0
              ? "Select one or more characters to view conflicts."
              : "No conflicts detected for the selected characters."}
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {selectedList.map((character) => {
              const conflicts = character.conflicts ?? [];
              if (conflicts.length === 0) return null;

              return (
                <section key={character.name} className="space-y-3">
                  <header className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {character.name}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {conflicts.length} conflict
                      {conflicts.length > 1 ? "s" : ""}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {conflicts.map((conflict) => (
                      <ConflictCard
                        key={conflict.id}
                        conflict={conflict}
                        onClick={() => onConflictClick(conflict)}
                        isSelected={selectedConflictId === conflict.id}
                        characterName={character.name}
                        onResolve={(decision) =>
                          onResolveConflict?.(
                            character.name,
                            conflict.id,
                            decision,
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
