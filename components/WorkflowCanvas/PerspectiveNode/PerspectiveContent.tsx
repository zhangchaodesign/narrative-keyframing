import { useMemo, type ReactNode } from "react";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";
import type { PerspectiveEvidenceItem } from "@/lib/types/workflow";
import { findTextMatches } from "@/lib/utils";

interface PerspectiveContentProps {
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
}

function createHighlightedSegments(
  text: string,
  ranges: Array<{ start: number; end: number }>,
): ReactNode[] {
  if (ranges.length === 0) {
    return [text];
  }

  // Sort and merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
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
        className="rounded bg-yellow-200 px-0.5 py-0.5 text-zinc-900"
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

export function PerspectiveContent({
  reflection,
  analysisEvidence,
}: PerspectiveContentProps) {
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );

  const highlightedReflection = useMemo<ReactNode>(() => {
    const reflectionText = reflection ?? "";
    if (!reflectionText) {
      return null;
    }

    // 1. Gather all evidence items based on selected attributes
    const analysisItems = analysisEvidence ?? [];
    const activeKeys = selectedEvidenceAttributes;
    if (
      analysisItems.length === 0 ||
      !activeKeys ||
      Object.keys(activeKeys).length === 0
    ) {
      return reflectionText;
    }

    // 2. Find all matching text ranges
    const ranges: Array<{ start: number; end: number }> = [];

    analysisItems.forEach((entry) => {
      const characterId = entry.characterId;
      entry.items.forEach((item) => {
        const shouldHighlight = item.attributes.some((attribute) =>
          Boolean(
            activeKeys[buildEvidenceAttributeKey(characterId, attribute)],
          ),
        );

        if (!shouldHighlight) {
          return;
        }

        const snippet = item.text;
        const matches = findTextMatches(reflectionText, snippet);
        ranges.push(...matches);
      });
    });

    // 3. Create highlighted segments (handles sorting, merging, and rendering)
    return createHighlightedSegments(reflectionText, ranges);
  }, [analysisEvidence, reflection, selectedEvidenceAttributes]);

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
      {highlightedReflection}
    </div>
  );
}
