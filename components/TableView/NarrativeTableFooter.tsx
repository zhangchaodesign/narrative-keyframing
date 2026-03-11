"use client";

type NarrativeTableFooterProps = {
  resolvedGroupLabel: string;
  eventCount: number;
  perspectiveCount: number;
  selectedSnippetCount: number;
  totalSnippetCount: number;
};

export function NarrativeTableFooter({
  resolvedGroupLabel,
  eventCount,
  perspectiveCount,
  selectedSnippetCount,
  totalSnippetCount,
}: NarrativeTableFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-6 py-2 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <span className="font-medium">{resolvedGroupLabel}</span>
        <span>•</span>
        <span>{eventCount} events</span>
        <span>•</span>
        <span>{perspectiveCount} perspectives</span>
      </div>
      <div className="flex items-center gap-2">
        <span>
          {selectedSnippetCount}/{totalSnippetCount} snippets selected
        </span>
      </div>
    </div>
  );
}
