"use client";

import { TbHighlight } from "react-icons/tb";
import type { ThirdPersonGroupNodeType } from "@/lib/types/workflow";

type NarrativeTableHeaderProps = {
  resolvedGroupId?: string;
  narrativeGroups: ThirdPersonGroupNodeType[];
  highlightEnabled: boolean;
  formatNarrativeClusterLabel: (group: ThirdPersonGroupNodeType) => string;
  onGroupChange: (nextGroupId?: string) => void;
  onToggleHighlight: () => void;
};

export function NarrativeTableHeader({
  resolvedGroupId,
  narrativeGroups,
  highlightEnabled,
  formatNarrativeClusterLabel,
  onGroupChange,
  onToggleHighlight,
}: NarrativeTableHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Narrative Overview - Table
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs font-medium text-gray-600">
            Narrative
          </span>
          <select
            value={resolvedGroupId ?? ""}
            onChange={(event) =>
              onGroupChange(event.target.value ? event.target.value : undefined)
            }
            className="select select-sm select-bordered"
            disabled={narrativeGroups.length === 0}
          >
            {narrativeGroups.length === 0 ? (
              <option value="">No groups</option>
            ) : (
              narrativeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {formatNarrativeClusterLabel(group)}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          onClick={onToggleHighlight}
          className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${
            highlightEnabled
              ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          title={
            highlightEnabled
              ? "Disable evidence highlighting"
              : "Enable evidence highlighting"
          }
          aria-label={
            highlightEnabled
              ? "Disable evidence highlighting"
              : "Enable evidence highlighting"
          }
        >
          <TbHighlight size={16} />
          <span>{highlightEnabled ? "Highlighting On" : "Highlighting Off"}</span>
        </button>
      </div>
    </div>
  );
}
