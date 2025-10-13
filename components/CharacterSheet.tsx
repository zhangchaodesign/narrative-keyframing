"use client";

import React, { useMemo } from "react";
import { type Character, useCharacterStore } from "@/lib/stores/characterStore";
import { AttributeEditor } from "./AttributeEditor";

type CharacterSheetProps = {
  character: Character;
  selectedAttribute: string | null;
  onAttributeClick: (attributeName: string) => void;
  enableEditing?: boolean;
};

export const CharacterSheet: React.FC<CharacterSheetProps> = React.memo(
  ({ character, selectedAttribute, onAttributeClick, enableEditing = true }) => {
    const { addAttributeToCharacter, removeAttributeFromCharacter, removeCharacter } =
      useCharacterStore();

    const grouped = useMemo(() => {
      const attrs = character?.attributes ?? [];
      return {
        physiology: attrs.filter((a) => a.category === "physiology"),
        psychology: attrs.filter((a) => a.category === "psychology"),
        sociology: attrs.filter((a) => a.category === "sociology"),
      };
    }, [character]);

    const handleAddAttribute = (category: string, value: string) => {
      addAttributeToCharacter(character.name, category, value);
    };

    const handleRemoveAttribute = (category: string, value: string) => {
      removeAttributeFromCharacter(character.name, category, value);
    };

    const handleDeleteCharacter = () => {
      if (confirm(`Are you sure you want to delete ${character.name}?`)) {
        removeCharacter(character.name);
      }
    };

    const hasConflict = (attrName: string) =>
      character?.conflicts?.some(
        (conflict) => conflict.establishedAttribute.name === attrName,
      );

    // For AI-extracted characters with no attributes, show extraction prompt
    if (
      !character ||
      (!character.attributes || character.attributes.length === 0) &&
      character.source === "ai-extracted" &&
      !enableEditing
    ) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-600">
          No attributes extracted yet. Click "Analyze" to extract attributes.
        </div>
      );
    }

    const GroupBlock: React.FC<{
      title: string;
      titleClass: string;
      prefix: string;
      category: string;
      items: Array<{ name: string; evidence: any[] }>;
      selectedClass: string;
      idleClass: string;
    }> = ({ title, titleClass, prefix, category, items, selectedClass, idleClass }) => (
      <div>
        <h4 className={`text-xs font-semibold mb-2 uppercase ${titleClass}`}>
          {title}
        </h4>
        <div className="flex flex-wrap gap-2 items-center">
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
              <div key={`${prefix}-${attr.name}`} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`${base} ${stateClass}`}
                  onClick={() => onAttributeClick(attr.name)}
                >
                  {conflict && "⚠️ "}
                  {attr.name} ({attr.evidence.length})
                </button>
                {enableEditing && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(category, attr.name)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="Remove attribute"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {enableEditing && (
            <AttributeEditor
              onAdd={(value) => handleAddAttribute(category, value)}
              placeholder={`Add ${title.toLowerCase()}...`}
            />
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded shadow hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-gray-800">
            Attributes for {character.name}
          </h3>
          {enableEditing && character.source === "manual" && (
            <button
              type="button"
              onClick={handleDeleteCharacter}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
              title="Delete character"
            >
              Delete
            </button>
          )}
        </div>

        <GroupBlock
          title="Physiology"
          titleClass="text-blue-700"
          prefix="phys"
          category="physiology"
          items={grouped.physiology}
          selectedClass="bg-blue-200 font-bold ring-2 ring-blue-400 border-blue-300"
          idleClass="bg-blue-50 hover:bg-blue-100 border-blue-200"
        />

        <GroupBlock
          title="Psychology"
          titleClass="text-purple-700"
          prefix="psych"
          category="psychology"
          items={grouped.psychology}
          selectedClass="bg-purple-200 font-bold ring-2 ring-purple-400 border-purple-300"
          idleClass="bg-purple-50 hover:bg-purple-100 border-purple-200"
        />

        <GroupBlock
          title="Sociology"
          titleClass="text-green-700"
          prefix="soc"
          category="sociology"
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
