"use client";

import React, { useState, useCallback, useRef } from "react";
import { createEditor, Range, NodeEntry, Transforms } from "slate";
import { Slate, Editable, withReact, RenderLeafProps } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { type Character } from "@/lib/stores/characterStore";
import isHotkey from "is-hotkey";

interface TextEditorProps {
  selectedCharacter: string | null;
  selectedAttribute: string | null;
  characters: Character[];
  conflictHighlight: { start: number; end: number } | null;
}

export default function TextEditor({
  selectedCharacter,
  selectedAttribute,
  characters,
  conflictHighlight,
}: TextEditorProps) {
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

  // Editor store
  const { value, matches, setValue } = useEditorStore();
  const [isReadOnly] = useState<boolean>(false);

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

  return (
    <div
      ref={editorContainerRef}
      className="h-full overflow-y-auto relative bg-white border border-zinc-200 rounded"
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
  );
}
