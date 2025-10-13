"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { CharacterSidebar } from "@/components/CharacterSidebar";
import { ConflictsSidebar } from "@/components/ConflictsSidebar";
import TextEditor from "@/components/TextEditor/TextEditor";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";

export function EditorPage() {
  const { characters } = useCharacterStore();

  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null,
  );
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

  useEffect(() => {
    if (!selectedCharacter) {
      setConflictHighlight(null);
      setSelectedConflictId(null);
      return;
    }
    const character = characters.find((c) => c.name === selectedCharacter);
    if (
      !character ||
      !character.conflicts ||
      character.conflicts.length === 0
    ) {
      setConflictHighlight(null);
      setSelectedConflictId(null);
    }
  }, [selectedCharacter, characters]);

  const handleCharacterClick = useCallback(
    (characterName: string) => {
      if (selectedCharacter === characterName) {
        setSelectedCharacter(null);
        setSelectedAttribute(null);
        setConflictHighlight(null);
        setSelectedConflictId(null);
        useEditorStore.getState().setMatches([]);
      } else {
        setSelectedCharacter(characterName);
        setSelectedAttribute(null);
        setConflictHighlight(null);
        setSelectedConflictId(null);
        const char = characters.find((c) => c.name === characterName);
        if (char) {
          const matches = char.coreferenceMatches.map((coref) => ({
            start: coref.startIndex,
            end: coref.endIndex,
          }));
          useEditorStore.getState().setMatches(matches);
        }
      }
    },
    [selectedCharacter, characters],
  );

  const handleAttributeClick = useCallback(
    (attributeName: string) => {
      if (selectedAttribute === attributeName) {
        setSelectedAttribute(null);
        useEditorStore.getState().setMatches([]);
      } else {
        setSelectedAttribute(attributeName);
        useEditorStore.getState().setMatches([]);
      }
    },
    [selectedAttribute],
  );

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

  return (
    <div className="flex h-screen flex-col">
      <Header />

      {/* Main area with centered, fixed-width strip */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <div className="flex items-start gap-4">
            {/* Left sidebar */}
            <div className="shrink-0">
              <CharacterSidebar
                characters={characters}
                selectedCharacter={selectedCharacter}
                selectedAttribute={selectedAttribute}
                onCharacterClick={handleCharacterClick}
                onAttributeClick={handleAttributeClick}
              />
            </div>

            {/* Editor (fixed width, no flex-1) */}
            <div className="w-[720px] shrink-0">
              <TextEditor
                selectedCharacter={selectedCharacter}
                selectedAttribute={selectedAttribute}
                characters={characters}
                conflictHighlight={conflictHighlight}
              />
            </div>

            {/* Right sidebar */}
            <div className="shrink-0">
              <ConflictsSidebar
                selectedCharacter={selectedCharacter}
                characters={characters}
                selectedConflictId={selectedConflictId}
                onConflictClick={handleConflictClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
