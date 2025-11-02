"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createEditor, Range, NodeEntry, Transforms, Editor } from "slate";
import { Slate, Editable, withReact, RenderLeafProps } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { SlateUtils } from "@/lib/slateUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import isHotkey from "is-hotkey";

interface TextEditorProps {
  conflictHighlight: { start: number; end: number } | null;
}

export default function TextEditor({ conflictHighlight }: TextEditorProps) {
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

  const { value, matches, setValue } = useEditorStore();
  const isReadOnly = false;

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

      // 2) Single conflict highlight (from ConflictsSidebar click)
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
    [matches, value, conflictHighlight],
  );

  useEffect(() => {
    if ((editor as any).children !== value) {
      (editor as any).children = value as any;
      editor.onChange();
    }
  }, [editor, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isHotkey("mod+z", e)) {
        e.preventDefault();
        HistoryEditor.undo(editor);
        return;
      }
      if (isHotkey("mod+shift+z", e) || isHotkey("mod+y", e)) {
        e.preventDefault();
        HistoryEditor.redo(editor);
      }
    },
    [editor],
  );

  return (
    <div className="h-full overflow-y-auto bg-white border-r border-zinc-100">
      <div className="px-12 py-8">
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
            onKeyDown={handleKeyDown}
          />
        </Slate>
      </div>
    </div>
  );
}
