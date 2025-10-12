"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  createEditor,
  Range,
  Editor,
  NodeEntry,
  Descendant,
  Transforms,
} from "slate";
import { Slate, Editable, withReact, RenderLeafProps } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { TextUtils } from "@/lib/utils/textUtils";
import { CoreferenceUtils } from "@/lib/utils/coreferenceUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { type AttributeConflict } from "@/lib/types/conflicts";
import isHotkey from "is-hotkey";

// Conflict Card Component (stacked vertically)
function ConflictCard({
  conflict,
  onClick,
}: {
  conflict: AttributeConflict;
  onClick: () => void;
}) {
  return (
    <div
      className="p-3 bg-red-50 border-2 border-red-300 rounded shadow hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
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
      <p className="text-sm text-gray-800 mb-1">
        Established:{" "}
        <span className="font-semibold">
          "{conflict.establishedAttribute.name}"
        </span>
      </p>
      <p className="text-xs text-gray-600 italic mb-2">
        {conflict.explanation}
      </p>
      <div className="text-[10px] text-gray-500 space-y-1">
        <p>Original: "{conflict.establishedAttribute.evidence.text}"</p>
        <p className="text-red-600 font-medium">
          Conflicts with: "{conflict.conflictingEvidence.text}"
        </p>
      </div>
    </div>
  );
}

export default function TextEditor() {
  const [editor] = useState(() => withHistory(withReact(createEditor())));
  const { normalizeNode } = editor;
  editor.normalizeNode = (entry) => {
    const [node, path] = entry;
    if (path.length === 0) {
      const children = (node as any).children;
      if (children.length > 1) {
        // add a newline at the beginning of the second paragraph,
        // then merge it into the first
        Transforms.insertText(editor, "\n", {
          at: { path: [1, 0], offset: 0 },
        });
        Transforms.mergeNodes(editor, { at: [1] });
        return; // done this pass
      }
    }
    normalizeNode(entry);
  };

  const value = useEditorStore((s) => s.value);
  const setValue = useEditorStore((s) => s.setValue);
  const isReadOnly = useEditorStore((s) => s.isReadOnly);

  const setCharacters = useCharacterStore((s) => s.setCharacters);
  const characters = useCharacterStore((s) => s.characters);

  const sentenceCaches = useSentenceCacheStore((s) => s.sentenceCaches);
  const cachedCharacterNames = useSentenceCacheStore(
    (s) => s.cachedCharacterNames,
  );
  const setSentenceCaches = useSentenceCacheStore((s) => s.setSentenceCaches);

  const editorMatches = useEditorStore((s) => s.matches);

  const [needle, setNeedle] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null,
  );
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(
    null,
  );

  // Ref for editor container
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 1) Flatten the Slate value (this already skips `.removed` text)
  const flatText = useMemo(() => SlateUtils.stateToText(value as any), [value]);

  // 2) (optional) clean the search term the same way if you want case/charset-insensitive matching
  const cleanedFlat = useMemo(
    () => TextUtils.prepareStringForMatching(flatText),
    [flatText],
  );
  const cleanedNeedle = useMemo(
    () => TextUtils.prepareStringForMatching(needle),
    [needle],
  );

  // 3) Use matcher; convert starts → {start,end}
  // Combine keyword matches with character coreference matches
  const matches = useMemo(() => {
    // If there are character matches from the store, use those
    if (editorMatches.length > 0) {
      return editorMatches;
    }

    // Otherwise, use keyword search matches
    if (needle.length === 0) {
      return [];
    }

    const starts = TextUtils.findAllMatches(cleanedFlat, cleanedNeedle);
    return starts.map((start) => ({
      start,
      end: start + cleanedNeedle.length,
    }));
  }, [cleanedFlat, cleanedNeedle, needle.length, editorMatches]);

  // 4) Decorate using SlateUtils.toSlatePoint on the ORIGINAL Slate state
  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      const ranges: Range[] = [];

      // Only compute once per editor node; Slate will call us for each node
      if (!Editor.isEditor(node)) return ranges;

      // Add coreference/keyword matches
      for (const m of matches) {
        // Convert string offsets into Slate Points.
        const anchor = SlateUtils.toSlatePoint(value as any, m.start);
        const focus = SlateUtils.toSlatePoint(value as any, m.end);

        if (anchor && focus) {
          ranges.push({ anchor, focus, highlight: true });
        }
      }

      // Add attribute evidence highlights for selected attribute
      if (selectedCharacter && selectedAttribute) {
        const character = characters.find((c) => c.name === selectedCharacter);
        if (character && character.attributes) {
          // Find the selected attribute
          const attribute = character.attributes.find(
            (attr) => attr.name === selectedAttribute,
          );

          if (attribute && attribute.evidence) {
            // Highlight all evidence for this attribute, color-coded by indicator type
            for (const evidence of attribute.evidence) {
              const anchor = SlateUtils.toSlatePoint(
                value as any,
                evidence.startIndex,
              );
              const focus = SlateUtils.toSlatePoint(
                value as any,
                evidence.endIndex,
              );

              if (anchor && focus) {
                ranges.push({
                  anchor,
                  focus,
                  [evidence.indicatorType]: true, // Color by indicator type
                });
              }
            }
          }
        }
      }

      return ranges;
    },
    [matches, value, selectedCharacter, selectedAttribute, characters],
  );

  // Handler for clicking a conflict card to highlight the conflicting evidence
  const handleConflictClick = useCallback((conflict: AttributeConflict) => {
    // Highlight the conflicting evidence in the editor
    const match = {
      start: conflict.conflictingEvidence.startIndex,
      end: conflict.conflictingEvidence.endIndex,
    };
    useEditorStore.getState().setMatches([match]);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Characters & Attributes */}
      <div className="w-80 overflow-y-auto flex-shrink-0">
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Characters</h2>

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
                  onClick={() => {
                    if (selectedCharacter === char.name) {
                      // Deselect character
                      setSelectedCharacter(null);
                      setSelectedAttribute(null);
                      useEditorStore.getState().setMatches([]);
                      setNeedle("");
                    } else {
                      // Select character and highlight coreferences
                      setSelectedCharacter(char.name);
                      setSelectedAttribute(null); // Clear selected attribute when switching characters
                      const matches = char.coreferenceMatches.map((coref) => ({
                        start: coref.startIndex,
                        end: coref.endIndex,
                      }));
                      useEditorStore.getState().setMatches(matches);
                      setNeedle(""); // Clear the keyword search
                      console.log(
                        `Highlighting ${matches.length} references for ${char.name}`,
                      );
                    }
                  }}
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
                            onClick={() => {
                              if (selectedAttribute === attr.name) {
                                setSelectedAttribute(null);
                                useEditorStore.getState().setMatches([]);
                              } else {
                                setSelectedAttribute(attr.name);
                                useEditorStore.getState().setMatches([]);
                              }
                            }}
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
                            onClick={() => {
                              if (selectedAttribute === attr.name) {
                                setSelectedAttribute(null);
                                useEditorStore.getState().setMatches([]);
                              } else {
                                setSelectedAttribute(attr.name);
                                useEditorStore.getState().setMatches([]);
                              }
                            }}
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
                            onClick={() => {
                              if (selectedAttribute === attr.name) {
                                setSelectedAttribute(null);
                                useEditorStore.getState().setMatches([]);
                              } else {
                                setSelectedAttribute(attr.name);
                                useEditorStore.getState().setMatches([]);
                              }
                            }}
                          >
                            {hasConflict(attr.name) && "⚠️ "}
                            {attr.name} ({attr.evidence.length})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAttribute && (
                    <p className="text-[10px] text-gray-600 mt-2 p-2 bg-white rounded border">
                      💡 Evidence is color-coded:{" "}
                      <span className="indicator-direct px-1">Direct</span>{" "}
                      <span className="indicator-actions px-1">Actions</span>{" "}
                      <span className="indicator-speech px-1">Speech</span>{" "}
                      <span className="indicator-appearance px-1">
                        Appearance
                      </span>{" "}
                      <span className="indicator-environment px-1">
                        Environment
                      </span>
                    </p>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Center - Text Editor */}
      <div className="flex-1 flex flex-col overflow-hidden my-2">
        {/* Toolbar */}
        <div className="bg-gray-50 p-3 flex items-center gap-3 justify-between w-full rounded">
          <button
            type="button"
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
            onClick={async () => {
              const story = SlateUtils.stateToText(value as any);
              console.log("Extracting characters from story:", story);

              try {
                // Step 1: Extract character names
                const charResponse = await fetch("/api/character", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ story }),
                });

                const charData = await charResponse.json();

                if (charData.error) {
                  alert(`Error: ${charData.error}`);
                  return;
                }

                const characterNames: string[] = charData.characters || [];
                console.log("Extracted character names:", characterNames);

                if (characterNames.length === 0) {
                  alert("No characters found in the story");
                  return;
                }

                // Step 2: Extract coreferences using smart caching
                const startTime = Date.now();

                const result =
                  await CoreferenceUtils.extractAllCoreferencesWithCache(
                    story,
                    characterNames,
                    sentenceCaches.length > 0 ? sentenceCaches : undefined,
                    cachedCharacterNames.length > 0
                      ? cachedCharacterNames
                      : undefined,
                  );

                const extractionTime = Date.now() - startTime;
                console.log(`Extraction completed in ${extractionTime}ms`);
                console.log(
                  "Characters with coreferences and indicators:",
                  result.characters,
                );

                // Step 3: Save to stores
                setCharacters(result.characters);
                setSentenceCaches(result.sentenceCaches, characterNames);

                // Show summary
                const summary = result.characters
                  .map((char) => {
                    const attributes = char.attributes || [];
                    const grouped = {
                      physiology: attributes.filter(
                        (a) => a.category === "physiology",
                      ).length,
                      psychology: attributes.filter(
                        (a) => a.category === "psychology",
                      ).length,
                      sociology: attributes.filter(
                        (a) => a.category === "sociology",
                      ).length,
                    };
                    const totalEvidence = attributes.reduce(
                      (sum, attr) => sum + attr.evidence.length,
                      0,
                    );
                    return `${char.name}: ${char.coreferenceMatches.length} refs | ${attributes.length} attributes (Phys: ${grouped.physiology}, Psych: ${grouped.psychology}, Soc: ${grouped.sociology}) | ${totalEvidence} evidence`;
                  })
                  .join("\n");

                alert(
                  `Extraction complete in ${(extractionTime / 1000).toFixed(
                    1,
                  )}s!\n\n${summary}`,
                );
              } catch (err) {
                console.error("Extraction error:", err);
                alert(
                  `Request failed: ${
                    err instanceof Error ? err.message : String(err)
                  }`,
                );
              }
            }}
          >
            Extract Characters
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
              onClick={() => HistoryEditor.undo(editor)}
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              className="border px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
              onClick={() => HistoryEditor.redo(editor)}
              title="Redo"
            >
              Redo
            </button>
          </div>

          {/* <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Keyword:</label>
            <input
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              className="border px-3 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              placeholder="type to highlight matches"
            />
          </div> */}
        </div>

        {/* Editor Container with Relative Positioning for Conflicts */}
        <div
          ref={editorContainerRef}
          className="flex-1 overflow-y-auto relative bg-white border border-zinc-200 my-2 rounded"
        >
          <div className="max-w-4xl mx-auto p-8">
            <Slate
              editor={editor}
              initialValue={useEditorStore.getState().value}
              onChange={setValue}
            >
              <Editable
                className="prose max-w-none focus:outline-none min-h-[600px] text-base leading-relaxed"
                renderLeaf={(p: RenderLeafProps) => <Leaf {...p} />}
                decorate={decorate}
                readOnly={isReadOnly}
                onKeyDown={(e) => {
                  if (isHotkey("mod+z", e)) {
                    e.preventDefault();
                    HistoryEditor.undo(editor);
                    return;
                  }
                  if (isHotkey("mod+shift+z", e) || isHotkey("mod+y", e)) {
                    e.preventDefault();
                    HistoryEditor.redo(editor);
                    return;
                  }
                }}
              />
            </Slate>
          </div>
        </div>
      </div>

      {/* Right Margin - Floating Conflicts */}
      <div className="w-80 relative flex-shrink-0">
        {selectedCharacter &&
          (() => {
            const character = characters.find(
              (c) => c.name === selectedCharacter,
            );
            if (
              !character ||
              !character.conflicts ||
              character.conflicts.length === 0
            ) {
              return (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Conflicts
                  </h3>
                  <p className="text-xs text-gray-500">
                    No conflicts detected for {selectedCharacter}
                  </p>
                </div>
              );
            }

            return (
              <div className="h-full overflow-y-auto">
                <div className="sticky top-0 p-4 z-10">
                  <h3 className="text-lg font-bold text-red-700">
                    ⚠️ Conflicts ({character.conflicts.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Click a conflict to highlight evidence
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  {character.conflicts.map((conflict) => (
                    <ConflictCard
                      key={conflict.id}
                      conflict={conflict}
                      onClick={() => handleConflictClick(conflict)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
