import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findTextMatches } from "@/lib/utiils/sharedUtils";

interface NarrativeContentProps {
  narration: string;
  snippetUsages?: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
  }>;
  isEditing?: boolean;
  onNarrationChange?: (newNarration: string) => void;
}

type HighlightRange = {
  start: number;
  end: number;
  originalSnippet: string;
};

function createHighlightedNarrative(
  text: string,
  snippetUsages: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
  }>,
): ReactNode[] {
  if (!snippetUsages || snippetUsages.length === 0) {
    return [text];
  }

  // Find all matching ranges in the narrative text
  const ranges: HighlightRange[] = [];

  snippetUsages.forEach((usage) => {
    const matches = findTextMatches(text, usage.verbatimInNarrative);
    ranges.push(
      ...matches.map((match) => ({
        ...match,
        originalSnippet: usage.originalSnippet,
      })),
    );
  });

  if (ranges.length === 0) {
    return [text];
  }

  // Sort and merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: HighlightRange[] = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
      // Keep the original snippet from the longer range
      last.originalSnippet = range.originalSnippet;
    }
  });

  // Generate segments with highlights
  const segments: ReactNode[] = [];
  let cursor = 0;

  merged.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push(
        <span key={`segment-${index}-text`}>
          {text.slice(cursor, range.start)}
        </span>,
      );
    }

    segments.push(
      <mark
        key={`segment-${index}-highlight`}
        className="rounded bg-green-200 px-0.5 py-0.5 text-zinc-900"
        title={`Based on: "${range.originalSnippet}"`}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });

  if (cursor < text.length) {
    segments.push(<span key="segment-tail">{text.slice(cursor)}</span>);
  }

  return segments;
}

export function NarrativeContent({
  narration,
  snippetUsages,
  isEditing = false,
  onNarrationChange,
}: NarrativeContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editValue, setEditValue] = useState(narration);

  useEffect(() => {
    setEditValue(narration);
  }, [narration]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const highlightedNarration = useMemo<ReactNode>(() => {
    const narrationText = narration ?? "";
    if (!narrationText) {
      return null;
    }

    return createHighlightedNarrative(narrationText, snippetUsages ?? []);
  }, [narration, snippetUsages]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setEditValue(nextValue);
          onNarrationChange?.(nextValue);
        }}
        className="flex-1 w-full resize-none rounded bg-white border border-zinc-300 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 nodrag nopan"
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
        onWheelCapture={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
      />
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800"
      onWheel={(event) => {
        if (event.ctrlKey || event.metaKey) {
          return;
        }
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
      }}
      onWheelCapture={(event) => {
        if (event.ctrlKey || event.metaKey) {
          return;
        }
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
      }}
    >
      {highlightedNarration}
    </div>
  );
}
