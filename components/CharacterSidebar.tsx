"use client";

import React, { useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore, type Character } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { Toolbar } from "@/components/Toolbar";
import { CharacterSheet } from "@/components/CharacterSheet";

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
  const { setCharacters } = useCharacterStore();
  const { sentenceCaches, cachedCharacterNames, setSentenceCaches } =
    useSentenceCacheStore();

  const handleExtractComplete = useCallback(
    (result: { characters: any[]; sentenceCaches: any[] }) => {
      setCharacters(result.characters);
      setSentenceCaches(
        result.sentenceCaches,
        result.characters.map((c) => c.name),
      );
    },
    [setCharacters, setSentenceCaches],
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
              onExtractComplete={handleExtractComplete}
            />
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Select one or more characters to view attributes.
          </p>
        </div>

        {/* Character list with multi-select toggles */}
        {characters.length > 0 && (
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
    </div>
  );
}
