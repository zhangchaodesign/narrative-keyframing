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

      for (const m of matches) {
        // Convert string offsets into Slate Points.
        const anchor = SlateUtils.toSlatePoint(value as any, m.start);
        const focus = SlateUtils.toSlatePoint(value as any, m.end);

        if (anchor && focus) {
          ranges.push({ anchor, focus, highlight: true });
        }
      }
      return ranges;
    },
    [matches, value],
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
                className="border px-3 py-1 rounded hover:bg-blue-100 text-sm"
                onClick={() => {
                  // Highlight all coreferences for this character
                  const matches = char.coreferenceMatches.map((coref) => ({
                    start: coref.startIndex,
                    end: coref.endIndex,
                  }));
                  useEditorStore.getState().setMatches(matches);
                  setNeedle(""); // Clear the keyword search
                  console.log(
                    `Highlighting ${matches.length} references for ${char.name}`,
                  );
                }}
              >
                {char.name} ({char.coreferenceMatches.length})
              </button>
            ))}
          </div>
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
              console.log("Characters with coreferences:", result.characters);

              // Step 3: Save to stores
              setCharacters(result.characters);
              setSentenceCaches(result.sentenceCaches, characterNames);

              // Show summary
              const summary = result.characters
                .map(
                  (char) =>
                    `${char.name}: ${char.coreferenceMatches.length} references`,
                )
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
