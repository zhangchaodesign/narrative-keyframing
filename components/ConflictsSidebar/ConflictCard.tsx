import React, { useCallback, useState } from "react";
import { geistMono } from "@/app/fonts";
import { cn } from "@/lib/utils/utils";
import { type AttributeConflict } from "@/lib/types/conflicts";
import { useEditorStore } from "@/lib/stores/editorStore";
import { TextUtils } from "@/lib/utils/textUtils";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { diffWords, type Change } from "diff";
import { useCharacterStore } from "@/lib/stores/characterStore";

interface ConflictCardProps {
  conflict: AttributeConflict;
  characterName: string;
  onClick: () => void;
  isSelected: boolean;
  onResolve?: (decision: "approved" | "rejected") => void;
}

export function ConflictCard({
  conflict,
  characterName,
  onClick,
  isSelected,
  onResolve,
}: ConflictCardProps) {
  const suggestion = useEditorStore((state) => state.suggestion);
  const beginSuggestion = useEditorStore((state) => state.beginSuggestion);
  const applySuggestion = useEditorStore((state) => state.applySuggestion);
  const clearSuggestion = useEditorStore((state) => state.clearSuggestion);

  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActiveSuggestion = suggestion?.conflictId === conflict.id;

  const handleResolveClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isResolving) return;

      try {
        setError(null);
        setIsResolving(true);

        const editorState = useEditorStore.getState();
        const baseStory = editorState.suggestion
          ? editorState.suggestion.originalText
          : SlateUtils.stateToText(editorState.value as any);

        if (!baseStory || baseStory.trim().length === 0) {
          setError("Story text is empty. Add content before resolving.");
          return;
        }

        const sentences = TextUtils.splitIntoSentences(baseStory);
        const conflictText = conflict.conflictingEvidence.text?.trim() ?? "";
        let targetSentence: { text: string; startIndex: number } | undefined =
          sentences[conflict.conflictingEvidence.sentenceIndex];

        if (
          targetSentence &&
          conflictText &&
          !targetSentence.text.includes(conflictText)
        ) {
          targetSentence = undefined;
        }

        if (!targetSentence && conflictText) {
          targetSentence = sentences.find((sentence) =>
            sentence.text.includes(conflictText),
          );
        }

        if (!targetSentence) {
          setError("Unable to locate the conflicting sentence in the story.");
          return;
        }

        const response = await fetch("/api/conflicts/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterName,
            originalSentence: targetSentence.text,
            attributeName: conflict.establishedAttribute.name,
            attributeCategory: conflict.category,
            conflictingEvidence: conflict.conflictingEvidence.text,
            establishedEvidence: conflict.establishedAttribute.evidence.text,
          }),
        });

        const responseData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));

        if (!response.ok) {
          throw new Error(responseData.error || "Failed to generate revision");
        }

        const revisedSentence = TextUtils.ensureSentenceTrailingSpace(
          String(responseData.revisedSentence || ""),
          targetSentence.text,
        );

        if (!revisedSentence.trim()) {
          setError("Model did not return a revised sentence.");
          return;
        }

        const diff = diffWords(
          targetSentence.text,
          revisedSentence,
        ) as Change[];
        const hasChange = diff.some((part) => part.added || part.removed);

        if (!hasChange) {
          setError("Model did not suggest any meaningful changes.");
          return;
        }

        beginSuggestion({
          conflictId: conflict.id,
          sentenceStart: targetSentence.startIndex,
          originalSentence: targetSentence.text,
          revisedSentence,
          sentenceIndex: conflict.conflictingEvidence.sentenceIndex,
          diffSegments: diff.map((part) => ({
            text: part.value,
            added: Boolean(part.added),
            removed: Boolean(part.removed),
          })),
        });
      } catch (err) {
        console.error("Failed to generate conflict resolution", err);
        setError("Failed to generate a resolution. Please try again.");
      } finally {
        setIsResolving(false);
      }
    },
    [
      beginSuggestion,
      characterName,
      conflict.category,
      conflict.conflictingEvidence.sentenceIndex,
      conflict.conflictingEvidence.text,
      conflict.establishedAttribute.evidence.text,
      conflict.establishedAttribute.name,
      conflict.id,
      isResolving,
    ],
  );

  const handleApprove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isActiveSuggestion) return;

      const currentSuggestion = suggestion;
      applySuggestion();

      const characterStore = useCharacterStore.getState();
      if (currentSuggestion) {
        characterStore.removeSentenceData(currentSuggestion.sentenceIndex);
        characterStore.shiftIndicesAfterSentenceChange(
          currentSuggestion.sentenceIndex,
          currentSuggestion.sentenceStart,
          currentSuggestion.originalSentence.length,
          currentSuggestion.revisedSentence.length,
        );
      }

      const { characters: updatedCharacters } = useCharacterStore.getState();
      const targetCharacter = updatedCharacters.find(
        (c) => c.name === characterName,
      );
      const remainingConflicts =
        targetCharacter?.conflicts?.filter((c) => c.id !== conflict.id) ?? [];
      useCharacterStore
        .getState()
        .updateCharacterConflicts(characterName, remainingConflicts);

      setError(null);
      onResolve?.("approved");
    },
    [
      applySuggestion,
      characterName,
      conflict.id,
      isActiveSuggestion,
      onResolve,
      suggestion,
    ],
  );

  const handleReject = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isActiveSuggestion) return;

      clearSuggestion();
      setError(null);
      onResolve?.("rejected");
    },
    [clearSuggestion, isActiveSuggestion, onResolve],
  );

  return (
    <div
      className={`p-3 bg-red-50 border-2 rounded shadow hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "border-red-600 ring-4 ring-red-300" : "border-red-300"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-white text-[10px] font-semibold ${
              conflict.severity === "high"
                ? "bg-red-600"
                : conflict.severity === "medium"
                ? "bg-orange-500"
                : "bg-yellow-500"
            }`}
          >
            {conflict.severity.toUpperCase()}
          </span>
          <span className="text-xs text-gray-600 font-semibold">
            {conflict.category}
          </span>
        </div>

        <button
          type="button"
          onClick={handleResolveClick}
          disabled={isResolving}
          className="rounded border border-red-400 px-2 py-1 text-[10px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isResolving ? "Resolving…" : "Resolve"}
        </button>
      </div>

      <p className="text-sm text-gray-800 mb-1">
        Established:{" "}
        <span className="font-semibold">
          "{conflict.establishedAttribute.name}"
        </span>
      </p>
      <p className="text-[10px] text-gray-600 mb-2">{conflict.explanation}</p>
      <div className="text-[10px] space-y-1">
        <div className="space-y-1">
          <p>Original</p>
          <p className={cn(geistMono.className, "p-1 bg-red-100 rounded")}>
            {conflict.establishedAttribute.evidence.text}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-red-600 font-medium">Conflicts with</p>
          <p className={cn(geistMono.className, "p-1 bg-red-100 rounded")}>
            {conflict.conflictingEvidence.text}
          </p>
        </div>
      </div>

      {isActiveSuggestion && (
        <>
          <p className="mt-3 text-[10px] text-gray-600">
            Suggested changes are highlighted in the editor. Approve to apply or
            reject to revert.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApprove}
              className="rounded bg-green-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-green-700"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded bg-gray-300 px-3 py-1 text-[11px] font-semibold text-gray-800 transition hover:bg-gray-400"
            >
              Reject
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 text-[10px] text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
