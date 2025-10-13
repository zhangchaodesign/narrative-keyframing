"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { CharacterSidebar } from "@/components/CharacterSidebar";
import { ConflictsSidebar } from "@/components/ConflictsSidebar";
import TextEditor from "@/components/TextEditor/TextEditor";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { type AttributeConflict } from "@/lib/types/conflicts";

export function EditorPage() {
  // Zustand stores
  const { characters, setCharacters } = useCharacterStore();
  const { setSentenceCaches } = useSentenceCacheStore();

  // Local state for UI interactions
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

  // Clear conflict highlight when character changes or has no conflicts
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

  // Character click handler
  const handleCharacterClick = useCallback(
    (characterName: string) => {
      if (selectedCharacter === characterName) {
        // Deselect character
        setSelectedCharacter(null);
        setSelectedAttribute(null);
        setConflictHighlight(null);
        setSelectedConflictId(null);
        useEditorStore.getState().setMatches([]);
      } else {
        // Select character and highlight coreferences
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
          console.log(
            `Highlighting ${matches.length} references for ${characterName}`,
          );
        }
      }
    },
    [selectedCharacter, characters],
  );

  // Attribute click handler
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

  // Conflict click handler
  const handleConflictClick = useCallback((conflict: AttributeConflict) => {
    setConflictHighlight({
      start: conflict.conflictingEvidence.startIndex,
      end: conflict.conflictingEvidence.endIndex,
    });
    setSelectedConflictId(conflict.id);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Characters & Attributes */}
        <CharacterSidebar
          characters={characters}
          selectedCharacter={selectedCharacter}
          selectedAttribute={selectedAttribute}
          onCharacterClick={handleCharacterClick}
          onAttributeClick={handleAttributeClick}
        />

        {/* Center - Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Text Editor */}
          <div className="flex-1 overflow-hidden py-4">
            <TextEditor
              selectedCharacter={selectedCharacter}
              selectedAttribute={selectedAttribute}
              characters={characters}
              conflictHighlight={conflictHighlight}
            />
          </div>
        </div>

        {/* Right Sidebar - Conflicts */}
        <ConflictsSidebar
          selectedCharacter={selectedCharacter}
          characters={characters}
          selectedConflictId={selectedConflictId}
          onConflictClick={handleConflictClick}
        />
      </div>
    </div>
  );
}
