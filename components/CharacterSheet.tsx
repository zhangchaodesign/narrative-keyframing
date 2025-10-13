"use client";

import React, { useMemo } from "react";
import { type Character } from "@/lib/stores/characterStore";

type CharacterSheetProps = {
  character: Character;
  selectedAttribute: string | null;
  onAttributeClick: (attributeName: string) => void;
};

export const CharacterSheet: React.FC<CharacterSheetProps> = React.memo(
  ({ character, selectedAttribute, onAttributeClick }) => {
    const grouped = useMemo(() => {
      const attrs = character?.attributes ?? [];
      return {
        physiology: attrs.filter((a) => a.category === "physiology"),
        psychology: attrs.filter((a) => a.category === "psychology"),
        sociology: attrs.filter((a) => a.category === "sociology"),
      };
    }, [character]);

    const hasConflict = (attrName: string) =>
      character?.conflicts?.some(
        (conflict) => conflict.establishedAttribute.name === attrName,
      );

    if (
      !character ||
      !character.attributes ||
      character.attributes.length === 0
    ) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-600">
          No attributes extracted yet. Click "Extract Characters" to analyze.
        </div>
      );
    }

    const GroupBlock: React.FC<{
      title: string;
      titleClass: string;
      prefix: string;
      items: Array<{ name: string; evidence: any[] }>;
      selectedClass: string;
      idleClass: string;
    }> = ({ title, titleClass, prefix, items, selectedClass, idleClass }) =>
      items.length > 0 ? (
        <div>
          <h4 className={`text-xs font-semibold mb-2 uppercase ${titleClass}`}>
            {title}
          </h4>
          <div className="flex flex-wrap gap-2">
            {items.map((attr) => {
              const isSelected = selectedAttribute === attr.name;
              const conflict = hasConflict(attr.name);
              const base =
                "border px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring";
              const conflictClass =
                "bg-red-100 border-red-400 hover:bg-red-200";
              const stateClass = conflict
                ? conflictClass
                : isSelected
                ? selectedClass
                : idleClass;

              return (
                <button
                  key={`${prefix}-${attr.name}`}
                  type="button"
                  className={`${base} ${stateClass}`}
                  onClick={() => onAttributeClick(attr.name)}
                >
                  {conflict && "⚠️ "}
                  {attr.name} ({attr.evidence.length})
                </button>
              );
            })}
          </div>
        </div>
      ) : null;

    return (
      <div className="space-y-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded shadow hover:shadow-md transition-shadow">
        <h3 className="font-semibold text-gray-800">
          Attributes for {character.name}
        </h3>

        <GroupBlock
          title="Physiology"
          titleClass="text-blue-700"
          prefix="phys"
          items={grouped.physiology}
          selectedClass="bg-blue-200 font-bold ring-2 ring-blue-400 border-blue-300"
          idleClass="bg-blue-50 hover:bg-blue-100 border-blue-200"
        />

        <GroupBlock
          title="Psychology"
          titleClass="text-purple-700"
          prefix="psych"
          items={grouped.psychology}
          selectedClass="bg-purple-200 font-bold ring-2 ring-purple-400 border-purple-300"
          idleClass="bg-purple-50 hover:bg-purple-100 border-purple-200"
        />

        <GroupBlock
          title="Sociology"
          titleClass="text-green-700"
          prefix="soc"
          items={grouped.sociology}
          selectedClass="bg-green-200 font-bold ring-2 ring-green-400 border-green-300"
          idleClass="bg-green-50 hover:bg-green-100 border-green-200"
        />

        {selectedAttribute && (
          <div className="p-2 bg-white rounded text-xs">
            <p className="font-semibold mb-1">Evidence Types:</p>
            <p className="flex flex-wrap gap-1">
              <span className="indicator-direct px-1">Direct Definition</span>{" "}
              <span className="indicator-actions px-1">Actions</span>{" "}
              <span className="indicator-speech px-1">Speech</span>{" "}
              <span className="indicator-appearance px-1">Appearance</span>{" "}
              <span className="indicator-environment px-1">Environment</span>
            </p>
          </div>
        )}
      </div>
    );
  },
);
