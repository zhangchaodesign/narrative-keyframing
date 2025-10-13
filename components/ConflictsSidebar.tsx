"use client";

import { ConflictCard } from "@/components/ConflictCard";
import { type Character } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";
import React, { useMemo } from "react";

interface ConflictsSidebarProps {
  /** ✅ multi-select */
  selectedCharacters: string[];
  characters: Character[];
  selectedConflictId: string | null;
  onConflictClick: (conflict: AttributeConflict) => void;
}

export function ConflictsSidebar({
  selectedCharacters,
  characters,
  selectedConflictId,
  onConflictClick,
}: ConflictsSidebarProps) {
  const { selectedList, totalConflicts } = useMemo(() => {
    const selectedSet = new Set(selectedCharacters);
    const sel = characters.filter((c) => selectedSet.has(c.name));
    const total = sel.reduce(
      (sum, c) => sum + (c.conflicts ? c.conflicts.length : 0),
      0,
    );
    return { selectedList: sel, totalConflicts: total };
  }, [selectedCharacters, characters]);

  // Always render the sidebar to maintain layout
  return (
    <div className="w-80 relative flex-shrink-0">
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 p-4 z-10 bg-white/80 backdrop-blur">
          <h3 className="text-lg font-bold text-red-700">
            ⚠️ Conflicts
            {typeof totalConflicts === "number" ? ` (${totalConflicts})` : ""}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Click a conflict to highlight evidence
          </p>
        </div>

        {/* Nothing selected or no conflicts */}
        {selectedList.length === 0 || totalConflicts === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            {selectedList.length === 0
              ? "Select one or more characters to view conflicts."
              : "No conflicts detected for the selected characters."}
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {selectedList.map((character) => {
              const conflicts = character.conflicts ?? [];
              if (conflicts.length === 0) return null;

              return (
                <section key={character.name} className="space-y-3">
                  <header className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {character.name}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {conflicts.length} conflict
                      {conflicts.length > 1 ? "s" : ""}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {conflicts.map((conflict) => (
                      <ConflictCard
                        key={conflict.id}
                        conflict={conflict}
                        onClick={() => onConflictClick(conflict)}
                        isSelected={selectedConflictId === conflict.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
