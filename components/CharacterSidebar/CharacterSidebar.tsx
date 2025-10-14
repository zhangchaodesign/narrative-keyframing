"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore, type Character } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { useRelationshipStore } from "@/lib/stores/relationshipStore";
import { Toolbar } from "@/components/CharacterSidebar/Toolbar";
import { CharacterSheet } from "@/components/CharacterSidebar/CharacterSheet";
import { AddCharacterModal } from "@/components/CharacterSidebar/AddCharacterModal";
import RelationshipGraph from "@/components/RelationshipGraph/RelationshipGraph";
import { CoreferenceUtils } from "@/lib/utils/coreferenceUtils";

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
      // Merge AI-extracted characters with existing characters
      const existingCharMap = new Map(characters.map((c) => [c.name, c]));
      const aiCharacters = result.characters;

      // Merge characters: combine attributes by name, keep source preference
      const mergedCharacters = aiCharacters.map((aiChar) => {
        const existingChar = existingCharMap.get(aiChar.name);
        if (existingChar) {
          // Character already exists - merge attributes by name
          const existingAttrMap = new Map(
            existingChar.attributes.map((attr) => [
              `${attr.category}-${attr.name}`,
              attr,
            ]),
          );

          // Merge AI attributes with existing ones
          const mergedAttributes = aiChar.attributes.map((aiAttr: any) => {
            const key = `${aiAttr.category}-${aiAttr.name}`;
            const existingAttr = existingAttrMap.get(key);

            if (existingAttr) {
              // Same attribute exists - merge evidence
              const attrProxy = existingAttr;
              for (const ev of aiAttr.evidence) {
                CoreferenceUtils.addEvidenceIfNewByText(attrProxy, ev);
              }
              return {
                ...aiAttr,
                evidence: attrProxy.evidence,
              };
            }
            return aiAttr; // New AI attribute
          });

          // Add existing attributes that weren't found in AI results
          existingChar.attributes.forEach((existingAttr) => {
            const key = `${existingAttr.category}-${existingAttr.name}`;
            const foundInAI = aiChar.attributes.some(
              (a: any) => `${a.category}-${a.name}` === key,
            );
            if (!foundInAI) {
              mergedAttributes.push(existingAttr);
            }
          });

          return {
            ...aiChar,
            source: existingChar.source, // Preserve original source
            attributes: mergedAttributes,
          };
        }
        return aiChar; // New AI character
      });

      // Add existing characters that weren't extracted by AI
      const aiCharNames = new Set(aiCharacters.map((c) => c.name));
      const existingOnlyChars = characters.filter(
        (c) => !aiCharNames.has(c.name),
      );

      const finalCharacters = [...mergedCharacters, ...existingOnlyChars];

      setCharacters(finalCharacters);
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
        <div className="p-4 bg-white/80 backdrop-blur border border-zinc-100 rounded select-none">
          <div className="w-full flex justify-between ">
            <h2 className="text-lg font-bold text-gray-800">Characters</h2>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-zinc-600 text-white rounded hover:bg-zinc-700 font-medium text-xs cursor-pointer"
            >
              + Add
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-1 mb-3">
            Select one or more characters to view attributes.
          </p>
          <Toolbar
            value={value}
            sentenceCaches={sentenceCaches}
            cachedCharacterNames={cachedCharacterNames}
            existingCharacters={characters}
            onExtractComplete={handleExtractComplete}
          />
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
