"use client";

import { ConflictCard } from "@/components/ConflictCard";
import { type Character } from "@/lib/stores/characterStore";
import { type AttributeConflict } from "@/lib/types/conflicts";

interface ConflictsSidebarProps {
  selectedCharacter: string | null;
  characters: Character[];
  selectedConflictId: string | null;
  onConflictClick: (conflict: AttributeConflict) => void;
}

export function ConflictsSidebar({
  selectedCharacter,
  characters,
  selectedConflictId,
  onConflictClick,
}: ConflictsSidebarProps) {
  if (!selectedCharacter) {
    return null;
  }

  const character = characters.find((c) => c.name === selectedCharacter);

  if (!character || !character.conflicts || character.conflicts.length === 0) {
    return (
      <div className="w-80 relative flex-shrink-0">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            Conflicts
          </h3>
          <p className="text-xs text-gray-500">
            No conflicts detected for {selectedCharacter}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 relative flex-shrink-0">
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 p-4 z-10">
          <h3 className="text-lg font-bold text-red-700">
            ⚠️ Conflicts ({character.conflicts.length})
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Click a conflict to highlight evidence
          </p>
        </div>
        <div className="p-4 space-y-3">
          {character.conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onClick={() => onConflictClick(conflict)}
              isSelected={selectedConflictId === conflict.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
