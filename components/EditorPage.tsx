"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { CharacterSidebar } from "@/components/CharacterSidebar/CharacterSidebar";
import { ConflictsSidebar } from "@/components/ConflictsSidebar/ConflictsSidebar";
import TextEditor from "@/components/TextEditor/TextEditor";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";

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
      if (selectedConflictId === conflict.id) {
        setSelectedConflictId(null);
        setConflictHighlight(null);
        return;
      }
      setSelectedConflictId(conflict.id);
      setConflictHighlight({
        start: conflict.conflictingEvidence.startIndex,
        end: conflict.conflictingEvidence.endIndex,
      });
    },
    [selectedConflictId],
  );

  const handleConflictResolve = useCallback(
    (_characterName: string, conflictId: string, decision: "approved" | "rejected") => {
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
