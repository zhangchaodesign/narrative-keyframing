"use client";

type NarrativeTableFooterProps = {
  outlineLabel?: string;
  resolvedGroupLabel: string;
  eventCount: number;
  perspectiveCount: number;
  selectedSnippetCount: number;
  totalSnippetCount: number;
};

export function NarrativeTableFooter({
  outlineLabel,
  resolvedGroupLabel,
  eventCount,
  perspectiveCount,
  selectedSnippetCount,
  totalSnippetCount,
}: NarrativeTableFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-2 py-2 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        {outlineLabel && (
          <>
            <span className="font-medium">{outlineLabel}</span>
            <span>•</span>
          </>
        )}
        <span className="font-medium">{resolvedGroupLabel}</span>
        <span>•</span>
        <span>{eventCount} plots</span>
        <span>•</span>
        <span>{perspectiveCount} characters</span>
      </div>
      <div className="flex items-center gap-2">
        <span>
          {selectedSnippetCount}/{totalSnippetCount} evidences selected
        </span>
      </div>
    </div>
  );
}
