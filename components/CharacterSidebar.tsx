"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore, type Character } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { useRelationshipStore } from "@/lib/stores/relationshipStore";
import { Toolbar } from "@/components/Toolbar";
import { CharacterSheet } from "@/components/CharacterSheet";
import { AddCharacterModal } from "@/components/AddCharacterModal";
import RelationshipGraph from "@/components/RelationshipGraph";

interface CharacterSidebarProps {
  characters: Character[];
  /** now multi-select */
  selectedCharacters: string[];
  /** keep attribute selection global for now; can switch to per-character if needed */
  selectedAttribute: string | null;
  /** toggles a character on/off in the selection */
  onCharacterToggle: (characterName: string) => void;
  onAttributeClick: (attributeName: string) => void;
}

export function CharacterSidebar({
  characters,
  selectedCharacters,
  selectedAttribute,
  onCharacterToggle,
  onAttributeClick,
}: CharacterSidebarProps) {
  const { value } = useEditorStore();
  const { setCharacters, createManualCharacter } = useCharacterStore();
  const { sentenceCaches, cachedCharacterNames, setSentenceCaches } =
    useSentenceCacheStore();
  const { relationships } = useRelationshipStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleExtractComplete = useCallback(
    (result: { characters: any[]; sentenceCaches: any[] }) => {
      setCharacters(result.characters);
      setSentenceCaches(
        result.sentenceCaches,
        result.characters.map((c) => c.name),
      );
    },
    [characters, setCharacters, setSentenceCaches],
  );

  const handleAddCharacter = useCallback(
    (name: string) => {
      createManualCharacter(name);
      // Auto-select the new character
      onCharacterToggle(name);
    },
    [createManualCharacter, onCharacterToggle],
  );

  const selectedSet = useMemo(
    () => new Set(selectedCharacters),
    [selectedCharacters],
  );

  const selectedList = useMemo(
    () => characters.filter((c) => selectedSet.has(c.name)),
    [characters, selectedSet],
  );

  return (
    <div className="w-80 overflow-y-auto flex-shrink-0">
      <div className="space-y-4">
        <div className="p-4 bg-white/80 backdrop-blur border border-zinc-100 rounded">
          <div className="w-full flex justify-between ">
            <h2 className="text-lg font-bold text-gray-800">Characters</h2>
            <Toolbar
              value={value}
              sentenceCaches={sentenceCaches}
              cachedCharacterNames={cachedCharacterNames}
              existingCharacters={characters}
              onExtractComplete={handleExtractComplete}
            />
          </div>

          <p className="text-xs text-gray-500 mt-1 mb-3">
            Select one or more characters to view attributes.
          </p>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
          >
            + Add Character
          </button>
        </div>

        {/* Character list with multi-select toggles */}
        {/* {characters.length > 0 && (
          <div className="space-y-2 px-4">
            {characters.map((char) => {
              const isSelected = selectedSet.has(char.name);
              return (
                <button
                  key={char.name}
                  type="button"
                  className={`w-full text-left border px-3 py-2 rounded text-sm transition-colors
                    ${
                      isSelected
                        ? "bg-blue-200 font-semibold border-blue-400"
                        : "bg-white hover:bg-blue-100"
                    }`}
                  onClick={() => onCharacterToggle(char.name)}
                  aria-pressed={isSelected}
                >
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        readOnly
                        checked={isSelected}
                        className="pointer-events-none accent-blue-600"
                      />
                      {char.name}
                      {char.conflicts?.length ? (
                        <div className="text-xs text-red-600 mt-1">
                          ⚠️ {char.conflicts.length} conflict
                          {char.conflicts.length > 1 ? "s" : ""}
                        </div>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-500">
                      {char.coreferenceMatches.length} refs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )} */}

        {/* Relationship Visualization Section */}
        {characters.length > 0 && (
          <div className="px-4">
            <div className="bg-white/80 backdrop-blur border border-zinc-100 rounded">
              <RelationshipGraph
                relationships={relationships}
                characters={characters}
                onCharacterClick={onCharacterToggle}
              />
            </div>
          </div>
        )}

        {/* Multiple CharacterSheets */}
        {selectedList.length > 0 && (
          <div className="space-y-4 px-4">
            {selectedList.map((character) => (
              <CharacterSheet
                key={character.name}
                character={character}
                selectedAttribute={selectedAttribute}
                onAttributeClick={onAttributeClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Character Modal */}
      <AddCharacterModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddCharacter}
      />
    </div>
  );
}
