"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { CharacterSidebar } from "@/components/CharacterSidebar/CharacterSidebar";
import { ConflictsSidebar } from "@/components/ConflictsSidebar/ConflictsSidebar";
import TextEditor from "@/components/TextEditor/TextEditor";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { TextUtils } from "@/lib/utils/textUtils";

export function EditorPage() {
  const { characters } = useCharacterStore();

  /** 🔁 MULTI-SELECT: use an array */
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(
    null,
  );
  const [conflictHighlight, setConflictHighlight] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    null,
  );

  /** When selection changes, clear conflict UI if nothing is selected */
  useEffect(() => {
    if (selectedCharacters.length === 0) {
      setConflictHighlight(null);
      setSelectedConflictId(null);
    }
  }, [selectedCharacters]);

  /** Clean up selectedCharacters when characters are deleted */
  useEffect(() => {
    const validCharacterNames = new Set(characters.map((c) => c.name));
    const invalidSelections = selectedCharacters.filter(
      (name) => !validCharacterNames.has(name),
    );
    if (invalidSelections.length > 0) {
      setSelectedCharacters((prev) =>
        prev.filter((name) => validCharacterNames.has(name)),
      );
    }
  }, [characters, selectedCharacters]);

  /** Recompute editor matches as the union of all selected characters' corefs */
  useEffect(() => {
    if (selectedCharacters.length === 0) {
      useEditorStore.getState().setMatches([]);
      return;
    }
    const selectedSet = new Set(selectedCharacters);
    const matches =
      characters
        .filter((c) => selectedSet.has(c.name))
        .flatMap((c) =>
          c.coreferenceMatches.map((m) => ({
            start: m.startIndex,
            end: m.endIndex,
          })),
        ) ?? [];
    useEditorStore.getState().setMatches(matches);
  }, [selectedCharacters, characters]);

  /** Toggle a character on/off */
  const handleCharacterToggle = useCallback((characterName: string) => {
    setSelectedAttribute(null);
    setConflictHighlight(null);
    setSelectedConflictId(null);
    setSelectedCharacters((prev) =>
      prev.includes(characterName)
        ? prev.filter((n) => n !== characterName)
        : [...prev, characterName],
    );
  }, []);

  /** Attribute click logic (kept global for now) */
  const handleAttributeClick = useCallback(
    (attributeName: string) => {
      if (selectedAttribute === attributeName) {
        setSelectedAttribute(null);
        useEditorStore.getState().setMatches([]);
      } else {
        setSelectedAttribute(attributeName);
        // If you want attribute-level evidence highlights, compute them here.
        useEditorStore.getState().setMatches([]);
      }
    },
    [selectedAttribute],
  );

  /** Conflict click (still tied to whichever conflict card is clicked) */
  const handleConflictClick = useCallback(
    (conflict: AttributeConflict) => {
      const currentlySelected = selectedConflictId === conflict.id;
      if (currentlySelected) {
        setSelectedConflictId(null);
        setConflictHighlight(null);
        return;
      }

      const editorState = useEditorStore.getState();
      const storyText = SlateUtils.stateToText(editorState.value as any);
      const sentences = TextUtils.splitIntoSentences(storyText);
      const conflictText = conflict.conflictingEvidence.text?.trim() ?? "";

      if (!conflictText) {
        setSelectedConflictId(conflict.id);
        setConflictHighlight(null);
        return;
      }

      let matchStart = -1;
      let matchEnd = -1;

      const sentence =
        sentences[conflict.conflictingEvidence.sentenceIndex] ?? null;

      const tryRegisterMatch = (baseStart: number, offset: number) => {
        if (offset >= 0) {
          matchStart = baseStart + offset;
          matchEnd = matchStart + conflictText.length;
          return true;
        }
        return false;
      };

      if (sentence) {
        const localIndex = sentence.text.indexOf(conflictText);
        if (!tryRegisterMatch(sentence.startIndex, localIndex)) {
          const fallbackIndex = TextUtils.findAllMatches(
            sentence.text,
            conflictText,
          )[0];
          tryRegisterMatch(
            sentence.startIndex,
            typeof fallbackIndex === "number" ? fallbackIndex : -1,
          );
        }
      }

      if (matchStart === -1) {
        const globalIndex = storyText.indexOf(conflictText);
        if (!tryRegisterMatch(0, globalIndex)) {
          const fallbackGlobal = TextUtils.findAllMatches(
            storyText,
            conflictText,
          )[0];
          tryRegisterMatch(0, typeof fallbackGlobal === "number" ? fallbackGlobal : -1);
        }
      }

      setSelectedConflictId(conflict.id);
      setConflictHighlight(
        matchStart >= 0 && matchEnd >= 0
          ? { start: matchStart, end: matchEnd }
          : null,
      );
    },
    [selectedConflictId],
  );

  const handleConflictResolve = useCallback(
    (
      _characterName: string,
      conflictId: string,
      decision: "approved" | "rejected",
    ) => {
      if (decision === "approved") {
        setConflictHighlight(null);
      }
      setSelectedConflictId((prev) => (prev === conflictId ? null : prev));
    },
    [],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header stays fixed height at top */}
      <div className="shrink-0">
        <Header />
      </div>

      {/* Main area: fills remaining height, no page scrolling */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-[1500px] px-6 pt-4 h-full">
          {/* Three-column strip */}
          <div className="flex h-full items-stretch gap-4 overflow-hidden">
            {/* Left: CharacterSidebar — its own scroll */}
            <div className="shrink-0 h-full overflow-y-auto pb-4">
              <CharacterSidebar
                characters={characters}
                selectedCharacters={selectedCharacters}
                selectedAttribute={selectedAttribute}
                onCharacterToggle={handleCharacterToggle}
                onAttributeClick={handleAttributeClick}
              />
            </div>

            {/* Middle: TextEditor — its own scroll */}
            <div className="w-[720px] shrink-0 h-full overflow-y-auto pb-4">
              <TextEditor
                selectedCharacters={selectedCharacters}
                selectedAttribute={selectedAttribute}
                characters={characters}
                conflictHighlight={conflictHighlight}
              />
            </div>

            {/* Right: ConflictsSidebar — its own scroll */}
            <div className="shrink-0 h-full overflow-y-auto pb-4">
              <ConflictsSidebar
                selectedCharacters={selectedCharacters}
                characters={characters}
                selectedConflictId={selectedConflictId}
                onConflictClick={handleConflictClick}
                onResolveConflict={handleConflictResolve}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
