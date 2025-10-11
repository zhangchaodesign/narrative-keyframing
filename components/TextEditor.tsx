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
import { Leaf } from "@/components/Leaf";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { TextUtils } from "@/lib/utils/textUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import isHotkey from "is-hotkey";

const initialValue: Descendant[] = [
  { type: "paragraph", children: [{ text: "Type or paste text here..." }] },
];

export const TextEditor = () => {
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

  const [needle, setNeedle] = useState("text");
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
  const matches = useMemo(() => {
    const starts = TextUtils.findAllMatches(cleanedFlat, cleanedNeedle);
    return starts.map((start) => ({
      start,
      end: start + cleanedNeedle.length,
    }));
  }, [cleanedFlat, cleanedNeedle]);

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
      <div className="flex items-center gap-2">
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

      <Slate editor={editor} initialValue={initialValue} onChange={setValue}>
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
};
