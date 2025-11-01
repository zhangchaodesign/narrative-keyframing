import { useMemo, type ReactNode } from "react";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";
import type { PerspectiveEvidenceItem } from "@/lib/types/workflow";

interface PerspectiveContentProps {
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
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

    const analysisItems = analysisEvidence ?? [];
    const activeKeys = selectedEvidenceAttributes;
    if (
      analysisItems.length === 0 ||
      !activeKeys ||
      Object.keys(activeKeys).length === 0
    ) {
      return reflectionText;
    }

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
        if (!snippet || snippet.trim().length === 0) {
          return;
        }

        let searchIndex = 0;
        const snippetLength = snippet.length;
        while (searchIndex <= reflectionText.length - snippetLength) {
          const matchIndex = reflectionText.indexOf(snippet, searchIndex);
          if (matchIndex === -1) {
            break;
          }
          ranges.push({ start: matchIndex, end: matchIndex + snippetLength });
          searchIndex = matchIndex + snippetLength;
        }
      });
    });

    if (ranges.length === 0) {
      return reflectionText;
    }

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

    const segments: ReactNode[] = [];
    let cursor = 0;

    merged.forEach((range, index) => {
      if (range.start > cursor) {
        segments.push(
          <span key={`segment-${index}-text`}>
            {reflectionText.slice(cursor, range.start)}
          </span>,
        );
      }

      segments.push(
        <mark
          key={`segment-${index}-highlight`}
          className="rounded bg-yellow-200 px-0.5 py-0.5 text-zinc-900"
        >
          {reflectionText.slice(range.start, range.end)}
        </mark>,
      );
      cursor = range.end;
    });

    if (cursor < reflectionText.length) {
      segments.push(
        <span key="segment-tail">{reflectionText.slice(cursor)}</span>,
      );
    }

    return segments;
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
