"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import isHotkey from "is-hotkey";

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

  return (
    <div className="p-4 space-y-3">
      {/* Character list display */}
      {characters.length > 0 && (
        <div className="border p-3 rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Characters:</h3>
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => (
              <button
                key={char.name}
                type="button"
                className={`border px-3 py-1 rounded hover:bg-blue-100 text-sm ${
                  selectedCharacter === char.name ? "bg-blue-200 font-bold" : ""
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
                {char.name} ({char.coreferenceMatches.length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attribute controls - grouped by Egri's categories */}
      {selectedCharacter && (
        <div className="border p-3 rounded bg-gray-50">
          <h3 className="font-semibold mb-3">
            Attributes for {selectedCharacter}:
          </h3>
          {(() => {
            const character = characters.find(
              (c) => c.name === selectedCharacter,
            );
            if (
              !character ||
              !character.attributes ||
              character.attributes.length === 0
            ) {
              return (
                <p className="text-gray-500 text-sm">
                  No attributes extracted yet. Click "Extract Characters" to
                  analyze.
                </p>
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

            return (
              <div className="space-y-3">
                {/* Physiology */}
                {grouped.physiology.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-blue-700 mb-1">
                      Physiology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.physiology.map((attr) => (
                        <button
                          key={`phys-${attr.name}`}
                          type="button"
                          className={`border px-3 py-1 rounded text-sm ${
                            selectedAttribute === attr.name
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
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Psychology */}
                {grouped.psychology.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-700 mb-1">
                      Psychology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.psychology.map((attr) => (
                        <button
                          key={`psych-${attr.name}`}
                          type="button"
                          className={`border px-3 py-1 rounded text-sm ${
                            selectedAttribute === attr.name
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
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sociology */}
                {grouped.sociology.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-1">
                      Sociology
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {grouped.sociology.map((attr) => (
                        <button
                          key={`soc-${attr.name}`}
                          type="button"
                          className={`border px-3 py-1 rounded text-sm ${
                            selectedAttribute === attr.name
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
                          {attr.name} ({attr.evidence.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAttribute && (
                  <p className="text-xs text-gray-600 mt-2">
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
      )}

      <div className="flex items-center gap-2">
        {/* Create a button to extract characters */}
        <button
          type="button"
          className="border px-2 py-1"
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
        <button
          type="button"
          className="border px-2 py-1"
          onClick={() => HistoryEditor.undo(editor)}
          title="Undo"
        >
          Undo
        </button>
        <button
          type="button"
          className="border px-2 py-1"
          onClick={() => HistoryEditor.redo(editor)}
          title="Redo"
        >
          Redo
        </button>

        {/* your existing keyword input */}
        <label className="text-sm">Keyword:</label>
        <input
          value={needle}
          onChange={(e) => setNeedle(e.target.value)}
          className="border px-2 py-1"
          placeholder="type to highlight matches"
        />
      </div>

      <Slate
        editor={editor}
        initialValue={useEditorStore.getState().value}
        onChange={setValue}
      >
        <Editable
          className="prose max-w-none focus:outline-none"
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
  );
}
