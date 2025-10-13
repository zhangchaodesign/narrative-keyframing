"use client";

import React, { useCallback } from "react";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { Toolbar } from "@/components/Toolbar";
import { type Character } from "@/lib/stores/characterStore";

interface CharacterSidebarProps {
  characters: Character[];
  selectedCharacter: string | null;
  selectedAttribute: string | null;
  onCharacterClick: (characterName: string) => void;
  onAttributeClick: (attributeName: string) => void;
}

export function CharacterSidebar({
  characters,
  selectedCharacter,
  selectedAttribute,
  onCharacterClick,
  onAttributeClick,
}: CharacterSidebarProps) {
  const { value, setValue } = useEditorStore();
  const { setCharacters } = useCharacterStore();
  const { sentenceCaches, cachedCharacterNames, setSentenceCaches } =
    useSentenceCacheStore();

  // Extract complete handler
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

  return (
    <div className="w-80 overflow-y-auto flex-shrink-0">
      <div className="p-4 space-y-4">
        <div className="w-full flex justify-between">
          <h2 className="text-lg font-bold text-gray-800">Characters</h2>
          <Toolbar
            value={value}
            sentenceCaches={sentenceCaches}
            cachedCharacterNames={cachedCharacterNames}
            onExtractComplete={handleExtractComplete}
          />
        </div>

        {/* Character list display */}
        {characters.length > 0 && (
          <div className="space-y-2">
            {characters.map((char) => (
              <button
                key={char.name}
                type="button"
                className={`w-full text-left border px-3 py-2 rounded hover:bg-blue-100 text-sm transition-colors ${
                  selectedCharacter === char.name
                    ? "bg-blue-200 font-bold border-blue-400"
                    : "bg-white"
                }`}
                onClick={() => onCharacterClick(char.name)}
              >
                <div className="flex justify-between items-center">
                  <span>{char.name}</span>
                  <span className="text-xs text-gray-500">
                    {char.coreferenceMatches.length} refs
                  </span>
                </div>
                {char.conflicts && char.conflicts.length > 0 && (
                  <div className="text-xs text-red-600 mt-1">
                    ⚠️ {char.conflicts.length} conflict
                    {char.conflicts.length > 1 ? "s" : ""}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Attribute controls - grouped by Egri's categories */}
        {selectedCharacter &&
          (() => {
            const character = characters.find(
              (c) => c.name === selectedCharacter,
            );
            if (
              !character ||
              !character.attributes ||
              character.attributes.length === 0
            ) {
              return (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-600">
                  No attributes extracted yet. Click "Extract Characters" to
                  analyze.
                </div>
              );
            }

            // Group attributes by category
            const grouped = {
              physiology: character.attributes.filter(
                (a) => a.category === "physiology",
              ),
              psychology: character.attributes.filter(
                (a) => a.category === "psychology",
              ),
              sociology: character.attributes.filter(
                (a) => a.category === "sociology",
              ),
            };

            // Helper to check if an attribute has conflicts
            const hasConflict = (attrName: string) => {
              return character.conflicts?.some(
                (conflict) => conflict.establishedAttribute.name === attrName,
              );
            };

            return (
              <div className="space-y-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded shadow hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-800">
                  Attributes for {selectedCharacter}
                </h3>

                {/* Physiology */}
                {grouped.physiology.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-blue-700 mb-2 uppercase">
                      Physiology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.physiology.map((attr) => (
                        <button
                          key={`phys-${attr.name}`}
                          type="button"
                          className={`border px-2 py-1 rounded text-xs transition-colors ${
                            hasConflict(attr.name)
                              ? "bg-red-100 border-red-400 hover:bg-red-200"
                              : selectedAttribute === attr.name
                              ? "bg-blue-200 font-bold ring-2 ring-blue-400"
                              : "bg-blue-50 hover:bg-blue-100"
                          }`}
                          onClick={() => onAttributeClick(attr.name)}
                        >
                          {hasConflict(attr.name) && "⚠️ "}
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Psychology */}
                {grouped.psychology.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-purple-700 mb-2 uppercase">
                      Psychology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.psychology.map((attr) => (
                        <button
                          key={`psych-${attr.name}`}
                          type="button"
                          className={`border px-2 py-1 rounded text-xs transition-colors ${
                            hasConflict(attr.name)
                              ? "bg-red-100 border-red-400 hover:bg-red-200"
                              : selectedAttribute === attr.name
                              ? "bg-purple-200 font-bold ring-2 ring-purple-400"
                              : "bg-purple-50 hover:bg-purple-100"
                          }`}
                          onClick={() => onAttributeClick(attr.name)}
                        >
                          {hasConflict(attr.name) && "⚠️ "}
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sociology */}
                {grouped.sociology.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-green-700 mb-2 uppercase">
                      Sociology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.sociology.map((attr) => (
                        <button
                          key={`soc-${attr.name}`}
                          type="button"
                          className={`border px-2 py-1 rounded text-xs transition-colors ${
                            hasConflict(attr.name)
                              ? "bg-red-100 border-red-400 hover:bg-red-200"
                              : selectedAttribute === attr.name
                              ? "bg-green-200 font-bold ring-2 ring-green-400"
                              : "bg-green-50 hover:bg-green-100"
                          }`}
                          onClick={() => onAttributeClick(attr.name)}
                        >
                          {hasConflict(attr.name) && "⚠️ "}
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Indicator legend */}
                {selectedAttribute && (
                  <div className="p-2 bg-white rounded text-xs">
                    <p className="font-semibold mb-1">Evidence Types:</p>
                    <p>
                      <span className="indicator-definition px-1">
                        Direct Definition
                      </span>{" "}
                      <span className="indicator-actions px-1">Actions</span>{" "}
                      <span className="indicator-speech px-1">Speech</span>{" "}
                      <span className="indicator-appearance px-1">
                        Appearance
                      </span>{" "}
                      <span className="indicator-environment px-1">
                        Environment
                      </span>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
