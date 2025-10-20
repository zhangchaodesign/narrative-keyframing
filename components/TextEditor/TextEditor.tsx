"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  createEditor,
  Range,
  NodeEntry,
  Transforms,
  Editor,
  Text,
  Point,
} from "slate";
import type { RangeRef } from "slate";
import {
  Slate,
  Editable,
  withReact,
  RenderLeafProps,
  ReactEditor,
} from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Leaf } from "@/components/TextEditor/Leaf";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { TextUtils } from "@/lib/utils/textUtils";
import { useEditorStore } from "@/lib/stores/editorStore";
import { type Character } from "@/lib/stores/characterStore";
import isHotkey from "is-hotkey";
import { geistMono } from "@/app/fonts";
import { cn } from "@/lib/utils/utils";
import SlashCommandMenu, {
  type SlashCommandPayload,
} from "@/components/TextEditor/SlashMenu";

type SlashMenuState = {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  targetRange: Range | null;
};

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
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuState>({
    isOpen: false,
    position: null,
    targetRange: null,
  });
  const [slashMenuError, setSlashMenuError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const suggestionRangeRef = useRef<RangeRef | null>(null);
  const [slashSuggestion, setSlashSuggestion] = useState<{
    payload: SlashCommandPayload;
  } | null>(null);

  const storyText = useMemo(
    () => SlateUtils.stateToText(value as any),
    [value],
  );

  const sentenceEntries = useMemo(
    () => TextUtils.splitIntoSentences(storyText),
    [storyText],
  );

  type AttributeHighlightRange = {
    start: number;
    end: number;
    indicatorType: string;
  };

  const attributeHighlightRanges = useMemo<AttributeHighlightRange[]>(() => {
    if (!selectedAttribute || selectedCharacters.length === 0) return [];

    const selectedSet = new Set(selectedCharacters);
    const relevantCharacters = characters.filter((c) =>
      selectedSet.has(c.name),
    );

    const sentenceUsage = new Map<
      number,
      Array<{ start: number; end: number }>
    >();
    const globalUsage: Array<{ start: number; end: number }> = [];

    const getUsageList = (
      sentenceIndex: number | null,
    ): Array<{ start: number; end: number }> => {
      if (sentenceIndex === null) return globalUsage;
      if (!sentenceUsage.has(sentenceIndex)) {
        sentenceUsage.set(sentenceIndex, []);
      }
      return sentenceUsage.get(sentenceIndex)!;
    };

    const registerUsage = (
      sentenceIndex: number | null,
      start: number,
      end: number,
    ) => {
      const usageList = getUsageList(sentenceIndex);
      usageList.push({ start, end });
    };

    const findMatchWithoutOverlap = (
      matchOffsets: number[],
      baseStart: number,
      length: number,
      sentenceIndex: number | null,
    ): { start: number; end: number } | null => {
      if (matchOffsets.length === 0) return null;
      const usageList = getUsageList(sentenceIndex);
      for (const offset of matchOffsets) {
        const start = baseStart + offset;
        const end = start + length;
        const overlaps = usageList.some(
          (range) => start < range.end && end > range.start,
        );
        if (!overlaps) {
          return { start, end };
        }
      }
      return null;
    };

    const ranges: AttributeHighlightRange[] = [];

    for (const character of relevantCharacters) {
      const attribute = character.attributes?.find(
        (a) => a.name === selectedAttribute,
      );
      if (!attribute) continue;

      for (const evidence of attribute.evidence ?? []) {
        const trimmedText = evidence.text?.trim();
        if (!trimmedText) continue;

        const evidenceLength = trimmedText.length;
        if (evidenceLength === 0) continue;

        const sentenceIndex =
          typeof evidence.sentenceIndex === "number"
            ? evidence.sentenceIndex
            : null;
        const sentence =
          sentenceIndex !== null ? sentenceEntries[sentenceIndex] : undefined;

        const legacyStart = (evidence as any)?.startIndex;
        const legacyEnd = (evidence as any)?.endIndex;
        if (
          typeof legacyStart === "number" &&
          typeof legacyEnd === "number" &&
          legacyEnd > legacyStart
        ) {
          registerUsage(sentenceIndex, legacyStart, legacyEnd);
          ranges.push({
            start: legacyStart,
            end: legacyEnd,
            indicatorType: evidence.indicatorType,
          });
          continue;
        }

        let matchResult: { start: number; end: number } | null = null;

        if (sentence) {
          const localMatches = TextUtils.findAllMatches(
            sentence.text,
            trimmedText,
          );
          matchResult = findMatchWithoutOverlap(
            localMatches,
            sentence.startIndex,
            evidenceLength,
            sentenceIndex,
          );
        }

        if (!matchResult) {
          const globalMatches = TextUtils.findAllMatches(
            storyText,
            trimmedText,
          );
          matchResult = findMatchWithoutOverlap(
            globalMatches,
            0,
            evidenceLength,
            null,
          );
        }

        if (matchResult) {
          registerUsage(sentenceIndex, matchResult.start, matchResult.end);
          ranges.push({
            start: matchResult.start,
            end: matchResult.end,
            indicatorType: evidence.indicatorType,
          });
        }
      }
    }

    return ranges;
  }, [
    selectedAttribute,
    selectedCharacters,
    characters,
    sentenceEntries,
    storyText,
  ]);

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
      if (attributeHighlightRanges.length > 0) {
        for (const evidenceRange of attributeHighlightRanges) {
          if (evidenceRange.start < nodeEnd && evidenceRange.end > nodeStart) {
            const anchor = SlateUtils.toSlatePoint(
              value as any,
              evidenceRange.start,
            );
            const focus = SlateUtils.toSlatePoint(
              value as any,
              evidenceRange.end,
            );
            if (anchor && focus) {
              ranges.push({
                anchor,
                focus,
                [evidenceRange.indicatorType]: true,
              } as any);
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
    [matches, value, attributeHighlightRanges, conflictHighlight],
  );

  useEffect(() => {
    if ((editor as any).children !== value) {
      (editor as any).children = value as any;
      editor.onChange();
    }
  }, [editor, value]);

  useEffect(() => {
    return () => {
      if (suggestionRangeRef.current) {
        suggestionRangeRef.current.unref();
        suggestionRangeRef.current = null;
      }
    };
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenuState({
      isOpen: false,
      position: null,
      targetRange: null,
    });
    setSlashMenuError(null);
  }, []);

  const openSlashMenu = useCallback(() => {
    const editorSelection = editor.selection;
    if (!editorSelection || !Range.isCollapsed(editorSelection)) return;

    const clonedRange = JSON.parse(JSON.stringify(editorSelection)) as Range;
    const viewportPadding = 12;
    const caretOffset = 8;
    const menuWidth = 320; // Tailwind w-80
    const menuHeightEstimate = 320;

    const resolveCaretRect = (): DOMRect | null => {
      try {
        const domRange = ReactEditor.toDOMRange(editor, editorSelection);
        let rect = domRange.getBoundingClientRect();
        if (rect && (rect.width !== 0 || rect.height !== 0)) {
          return rect;
        }
        const firstClientRect = domRange.getClientRects()[0];
        if (firstClientRect) {
          return firstClientRect;
        }
        if (typeof window === "undefined") return rect ?? null;
        const marker = document.createElement("span");
        marker.textContent = "\u200b";
        marker.style.display = "inline-block";
        marker.style.width = "1px";
        marker.style.height = "1em";
        marker.style.pointerEvents = "none";
        marker.style.opacity = "0";
        const tempRange = domRange.cloneRange();
        tempRange.insertNode(marker);
        rect = marker.getBoundingClientRect();
        if (marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
        const domSelection = window.getSelection();
        if (domSelection) {
          domSelection.removeAllRanges();
          domSelection.addRange(domRange);
        }
        return rect ?? null;
      } catch {
        return null;
      }
    };

    let rect: DOMRect | null = resolveCaretRect();

    const isRectEmpty = (r: DOMRect | null) =>
      !r ||
      Number.isNaN(r.top) ||
      Number.isNaN(r.left) ||
      (r.width === 0 && r.height === 0);

    if (isRectEmpty(rect) && typeof window !== "undefined") {
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const fallbackRange = domSelection.getRangeAt(0);
        const fallbackRect = fallbackRange.getBoundingClientRect();
        if (fallbackRect && !Number.isNaN(fallbackRect.top)) {
          rect = fallbackRect;
        }
      }
    }

    if (isRectEmpty(rect)) {
      try {
        const [blockNode] = Editor.parent(editor, editorSelection.anchor.path);
        const domElement = ReactEditor.toDOMNode(editor, blockNode as any);
        const elementRect = domElement.getBoundingClientRect();
        if (!Number.isNaN(elementRect.top)) {
          rect = elementRect;
        }
      } catch {
        rect = null;
      }
    }

    if (!rect || Number.isNaN(rect.top)) {
      try {
        const anchorPath = editorSelection.anchor.path;
        const [parentNode] = Editor.parent(editor, anchorPath);
        const domNode = ReactEditor.toDOMNode(editor, parentNode as any);
        const parentRect = domNode.getBoundingClientRect();
        if (parentRect && !Number.isNaN(parentRect.top)) {
          rect = parentRect;
        }
      } catch {
        rect = null;
      }
    }

    if (!rect) {
      console.error("Failed to resolve caret position for slash command menu.");
      return;
    }

    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : menuWidth;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : menuHeightEstimate;

    let left = rect.left;
    let top = rect.bottom + caretOffset;

    if (left + menuWidth + viewportPadding > viewportWidth) {
      left = Math.max(
        viewportPadding,
        viewportWidth - menuWidth - viewportPadding,
      );
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    if (top + menuHeightEstimate + viewportPadding > viewportHeight) {
      const abovePosition = rect.top - menuHeightEstimate - caretOffset;
      if (abovePosition >= viewportPadding) {
        top = abovePosition;
      } else {
        top = Math.max(
          viewportPadding,
          viewportHeight - menuHeightEstimate - viewportPadding,
        );
      }
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    setSlashMenuState({
      isOpen: true,
      position: { top, left },
      targetRange: clonedRange,
    });
    setSlashMenuError(null);
  }, [editor]);

  const handleSlashSubmit = useCallback(
    async (payload: SlashCommandPayload, rangeOverride?: Range | null) => {
      const targetRange = rangeOverride ?? slashMenuState.targetRange;
      if (!targetRange) {
        setSlashMenuError(
          "Place the cursor in the story where you want the AI sentence.",
        );
        return;
      }

      if (!rangeOverride && slashSuggestion) {
        setSlashMenuError(
          "Resolve the existing AI sentence before inserting another.",
        );
        return;
      }

      setIsGenerating(true);
      setSlashMenuError(null);

      try {
        const currentState = editor.children as any;
        const storyText = SlateUtils.stateToText(currentState);

        const response = await fetch("/api/story/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story: storyText,
            characterName: payload.characterName,
            attributes: payload.attributes,
            instruction: payload.instruction,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error ?? "Failed to generate a continuation sentence.",
          );
        }

        const sentence: string | undefined =
          typeof data?.sentence === "string" ? data.sentence.trim() : undefined;

        if (!sentence) {
          throw new Error("The model did not return a sentence.");
        }

        let insertionRange = JSON.parse(JSON.stringify(targetRange)) as Range;
        let insertionIndex = 0;

        if (
          SlateUtils.isSelectionValidForState(
            insertionRange,
            currentState as any,
          )
        ) {
          insertionIndex = SlateUtils.toStrIndex(
            currentState as any,
            insertionRange.anchor,
          );
        } else {
          const endPoint = Editor.end(editor, []);
          insertionRange = { anchor: endPoint, focus: endPoint };
          insertionIndex = storyText.length;
        }

        Transforms.select(editor, insertionRange);
        ReactEditor.focus(editor);

        const previousChar =
          insertionIndex > 0 ? storyText[insertionIndex - 1] : undefined;
        const needsLeadingSpace =
          previousChar !== undefined && !/\s/.test(previousChar);

        const clonePoint = (point: Point): Point => ({
          path: [...point.path],
          offset: point.offset,
        });

        if (needsLeadingSpace) {
          Transforms.insertText(editor, " ");
          if (editor.selection?.anchor) {
            Transforms.select(editor, editor.selection.anchor);
          }
        }

        const startAnchor = editor.selection?.anchor ?? insertionRange.anchor;
        const startPoint = clonePoint(startAnchor);

        const sentenceNode: Text = { text: sentence, added: true };
        Transforms.insertNodes(editor, sentenceNode);

        const endAnchor =
          editor.selection?.anchor ??
          Editor.after(editor, startPoint, { voids: false }) ??
          startPoint;
        const endPoint = clonePoint(endAnchor);

        if (suggestionRangeRef.current) {
          suggestionRangeRef.current.unref();
        }
        const insertedRange: Range = {
          anchor: startPoint,
          focus: endPoint,
        };
        suggestionRangeRef.current = Editor.rangeRef(editor, insertedRange);
        setSlashSuggestion({ payload });
        closeSlashMenu();
      } catch (error) {
        console.error("Failed to generate continuation sentence:", error);
        setSlashMenuError(
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the sentence.",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [closeSlashMenu, editor, slashMenuState.targetRange, slashSuggestion],
  );

  const handleApproveSuggestion = useCallback(() => {
    if (!slashSuggestion || !suggestionRangeRef.current) return;
    const range = suggestionRangeRef.current.current;
    if (!range) return;

    Transforms.setNodes(
      editor,
      { added: undefined },
      {
        at: range,
        match: Text.isText,
        split: true,
      },
    );

    suggestionRangeRef.current.unref();
    suggestionRangeRef.current = null;
    setSlashSuggestion(null);
    setSlashMenuError(null);
  }, [editor, slashSuggestion]);

  const handleRejectSuggestion = useCallback(() => {
    if (!slashSuggestion || !suggestionRangeRef.current) return;
    const range = suggestionRangeRef.current.current;
    if (!range) return;

    Transforms.select(editor, range);
    Transforms.delete(editor);

    suggestionRangeRef.current.unref();
    suggestionRangeRef.current = null;
    setSlashSuggestion(null);
    setSlashMenuError(null);
  }, [editor, slashSuggestion]);

  const handleRegenerateSuggestion = useCallback(async () => {
    if (!slashSuggestion || !suggestionRangeRef.current) return;
    const range = suggestionRangeRef.current.current;
    if (!range) return;

    Transforms.select(editor, range);
    Transforms.delete(editor);

    const selectionAnchor = editor.selection?.anchor;
    const newRange: Range | null = selectionAnchor
      ? {
          anchor: {
            path: [...selectionAnchor.path],
            offset: selectionAnchor.offset,
          },
          focus: {
            path: [...selectionAnchor.path],
            offset: selectionAnchor.offset,
          },
        }
      : null;

    suggestionRangeRef.current.unref();
    suggestionRangeRef.current = null;
    setSlashSuggestion(null);
    setSlashMenuError(null);

    await handleSlashSubmit(slashSuggestion.payload, newRange);
  }, [editor, handleSlashSubmit, slashSuggestion]);

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
            className={cn(
              geistMono.className,
              "prose max-w-none focus:outline-none min-h-[600px] text-base leading-relaxed",
            )}
            renderLeaf={(p: RenderLeafProps) => <Leaf {...p} />}
            decorate={decorate}
            readOnly={isReadOnly}
            onKeyDown={(e) => {
              if (slashMenuState.isOpen && e.key === "Escape") {
                e.preventDefault();
                closeSlashMenu();
                return;
              }
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
              if (
                e.key === "/" &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !slashMenuState.isOpen &&
                !isReadOnly &&
                !isGenerating
              ) {
                e.preventDefault();
                openSlashMenu();
                return;
              }
            }}
          />
        </Slate>
        <SlashCommandMenu
          isOpen={slashMenuState.isOpen}
          position={slashMenuState.position}
          characters={characters}
          isGenerating={isGenerating}
          error={slashMenuError}
          onClose={closeSlashMenu}
          onSubmit={handleSlashSubmit}
        />
        {slashSuggestion && (
          <div className="absolute bottom-6 right-6 rounded border border-blue-200 bg-blue-50 p-2 text-blue-900">
            <p className="text-[10px]">AI continuation pending approval</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="rounded bg-green-600 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-green-700 cursor-pointer"
                onClick={handleApproveSuggestion}
                disabled={isGenerating}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
                onClick={handleRegenerateSuggestion}
                disabled={isGenerating}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="rounded bg-zinc-200 px-3 py-1 text-[10px] font-semibold text-zinc-800 transition hover:bg-zinc-300 cursor-pointer"
                onClick={handleRejectSuggestion}
                disabled={isGenerating}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
