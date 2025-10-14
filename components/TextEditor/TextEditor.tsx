"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createEditor, Range, NodeEntry, Transforms } from "slate";
import { Slate, Editable, withReact, RenderLeafProps } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { type Character } from "@/lib/stores/characterStore";
import isHotkey from "is-hotkey";
import { geistMono } from "@/app/fonts";
import { cn } from "@/lib/utils/utils";

interface TextEditorProps {
  /** ✅ multi-select */
  selectedCharacters: string[];
  /** still global unless you move to per-character */
  selectedAttribute: string | null;
  characters: Character[];
  conflictHighlight: { start: number; end: number } | null;
}

export default function TextEditor({
  selectedCharacters,
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
        Transforms.insertText(editor, "\n", {
          at: { path: [1, 0], offset: 0 },
        });
        Transforms.mergeNodes(editor, { at: [1] });
        return;
      }
    }
    normalizeNode(entry);
  };

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Editor store
  const { value, matches, setValue } = useEditorStore();
  const [isReadOnly] = useState<boolean>(false);

  const decorate = useCallback(
    ([node, path]: NodeEntry): Range[] => {
      const ranges: Range[] = [];
      if (!(node as any).text) return ranges;

      const nodeStart = SlateUtils.toStrIndex(value as any, {
        path,
        offset: 0,
      });
      const nodeEnd = nodeStart + (node as any).text.length;

      // 1) Coreference matches (union already computed in parent & stored)
      if (matches && matches.length > 0) {
        for (const match of matches) {
          if (match.start < nodeEnd && match.end > nodeStart) {
            const anchor = SlateUtils.toSlatePoint(value as any, match.start);
            const focus = SlateUtils.toSlatePoint(value as any, match.end);
            if (anchor && focus)
              ranges.push({ anchor, focus, highlight: true } as any);
          }
        }
      }

      // 2) Attribute evidence across ALL selected characters (if attribute chosen)
      if (selectedAttribute && selectedCharacters.length > 0) {
        const selectedSet = new Set(selectedCharacters);
        const selectedChars = characters.filter((c) => selectedSet.has(c.name));

        for (const character of selectedChars) {
          const attribute = character.attributes?.find(
            (a) => a.name === selectedAttribute,
          );
          if (!attribute) continue;

          for (const evidence of attribute.evidence ?? []) {
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
                  [evidence.indicatorType]: true, // same color-by-indicator behavior
                } as any);
              }
            }
          }
        }
      }

      // 3) Single conflict highlight (from ConflictsSidebar click)
      if (conflictHighlight) {
        const anchor = SlateUtils.toSlatePoint(
          value as any,
          conflictHighlight.start,
        );
        const focus = SlateUtils.toSlatePoint(
          value as any,
          conflictHighlight.end,
        );
        if (anchor && focus)
          ranges.push({ anchor, focus, conflictHighlight: true } as any);
      }

      return ranges;
    },
    [
      matches,
      value,
      selectedAttribute,
      selectedCharacters,
      characters,
      conflictHighlight,
    ],
  );

  useEffect(() => {
    if ((editor as any).children !== value) {
      (editor as any).children = value as any;
      editor.onChange();
    }
  }, [editor, value]);

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        geistMono.className,
        "h-full overflow-y-auto relative bg-white border border-zinc-200 rounded",
      )}
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
