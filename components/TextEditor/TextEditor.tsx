"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createEditor, Range, NodeEntry, Transforms } from "slate";
import { Slate, Editable, withReact, RenderLeafProps } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { CharacterSidebar } from "@/components/CharacterSidebar";
import { ConflictsSidebar } from "@/components/ConflictsSidebar";
import { EditorToolbar } from "@/components/EditorToolbar";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useCharacterStore } from "@/lib/stores/characterStore";
import { useSentenceCacheStore } from "@/lib/stores/sentenceCacheStore";
import { type AttributeConflict } from "@/lib/types/conflicts";
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

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Zustand stores
  const { value, matches, setValue } = useEditorStore();
  const { characters, setCharacters } = useCharacterStore();
  const { sentenceCaches, cachedCharacterNames, setSentenceCaches } =
    useSentenceCacheStore();

  // Local state
  const [isReadOnly] = useState<boolean>(false);
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

  // Decorate function for highlights
  const decorate = useCallback(
    ([node, path]: NodeEntry): Range[] => {
      const ranges: Range[] = [];

      // Only process text nodes
      if (!(node as any).text) {
        return ranges;
      }

      // Add coreference matches for selected character
      if (matches && matches.length > 0) {
        const nodeStart = SlateUtils.toStrIndex(value as any, {
          path,
          offset: 0,
        });

        for (const match of matches) {
          const nodeEnd = nodeStart + (node as any).text.length;
          if (match.start < nodeEnd && match.end > nodeStart) {
            const anchor = SlateUtils.toSlatePoint(value as any, match.start);
            const focus = SlateUtils.toSlatePoint(value as any, match.end);
            if (anchor && focus) {
              ranges.push({ anchor, focus, highlight: true } as any);
            }
          }
        }
      }

      // Add attribute evidence highlighting with indicator types
      if (selectedCharacter && selectedAttribute) {
        const character = characters.find((c) => c.name === selectedCharacter);
        if (character && character.attributes) {
          const attribute = character.attributes.find(
            (a) => a.name === selectedAttribute,
          );
          if (attribute) {
            const nodeStart = SlateUtils.toStrIndex(value as any, {
              path,
              offset: 0,
            });

            for (const evidence of attribute.evidence) {
              const nodeEnd = nodeStart + (node as any).text.length;
              if (
                evidence.startIndex < nodeEnd &&
                evidence.endIndex > nodeStart
              ) {
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
      }

      // Add conflict highlight (separate from character coreference highlighting)
      if (conflictHighlight) {
        const anchor = SlateUtils.toSlatePoint(
          value as any,
          conflictHighlight.start,
        );
        const focus = SlateUtils.toSlatePoint(
          value as any,
          conflictHighlight.end,
        );

        if (anchor && focus) {
          ranges.push({ anchor, focus, conflictHighlight: true } as any);
        }
      }

      return ranges;
    },
    [
      matches,
      value,
      selectedCharacter,
      selectedAttribute,
      characters,
      conflictHighlight,
    ],
  );

  // Conflict click handler
  const handleConflictClick = useCallback((conflict: AttributeConflict) => {
    // Set conflict highlight (separate from character coreferences)
    setConflictHighlight({
      start: conflict.conflictingEvidence.startIndex,
      end: conflict.conflictingEvidence.endIndex,
    });
    // Track which conflict is selected
    setSelectedConflictId(conflict.id);
  }, []);

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
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Characters & Attributes */}
      <CharacterSidebar
        characters={characters}
        selectedCharacter={selectedCharacter}
        selectedAttribute={selectedAttribute}
        onCharacterClick={handleCharacterClick}
        onAttributeClick={handleAttributeClick}
      />

      {/* Center - Text Editor */}
      <div className="flex-1 flex flex-col overflow-hidden my-2">
        {/* Toolbar */}
        <EditorToolbar
          editor={editor}
          value={value}
          sentenceCaches={sentenceCaches}
          cachedCharacterNames={cachedCharacterNames}
          onExtractComplete={handleExtractComplete}
        />

        {/* Editor Container */}
        <div
          ref={editorContainerRef}
          className="flex-1 overflow-y-auto relative bg-white border border-zinc-200 my-2 rounded"
        >
          <div className="px-24 py-12">
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

      {/* Right Sidebar - Conflicts */}
      <ConflictsSidebar
        selectedCharacter={selectedCharacter}
        characters={characters}
        selectedConflictId={selectedConflictId}
        onConflictClick={handleConflictClick}
      />
    </div>
  );
}
