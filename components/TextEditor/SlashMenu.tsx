"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { type Character } from "@/lib/stores/characterStore";
import {
  type AttributeCategory,
  type CharacterAttribute,
} from "@/lib/types/attributes";
import { type IndicatorType } from "@/lib/types/indicators";
import { TbX } from "react-icons/tb";

const EVIDENCE_TYPES: IndicatorType[] = [
  "directDefinition",
  "actions",
  "speech",
  "appearance",
  "environment",
];

const EVIDENCE_TYPE_LABELS: Record<IndicatorType, string> = {
  directDefinition: "Direct Definition",
  actions: "Actions",
  speech: "Speech",
  appearance: "Appearance",
  environment: "Environment",
};

const ATTRIBUTE_CATEGORY_LABELS: Record<AttributeCategory, string> = {
  physiology: "Physiology",
  psychology: "Psychology",
  sociology: "Sociology",
};

export type AttributeEvidenceSelection = {
  name: string;
  category: AttributeCategory;
  evidenceTypes: IndicatorType[];
  evidenceSnippets: Array<{
    indicatorType: IndicatorType;
    text: string;
  }>;
};

export type SlashCommandPayload = {
  characterName: string;
  attributes: AttributeEvidenceSelection[];
  instruction: string;
};

const getAttributeKey = (attribute: CharacterAttribute) =>
  `${attribute.category}::${attribute.name}`;

interface SlashCommandMenuProps {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  characters: Character[];
  isGenerating: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: SlashCommandPayload) => void;
}

export function SlashCommandMenu({
  isOpen,
  position,
  characters,
  isGenerating,
  error,
  onClose,
  onSubmit,
}: SlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCharacterName, setSelectedCharacterName] =
    useState<string>("");
  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(
    () => new Set(),
  );
  const [attributeEvidence, setAttributeEvidence] = useState<
    Record<string, Set<IndicatorType>>
  >({});
  const [customInstruction, setCustomInstruction] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedCharacterName("");
      setSelectedAttributes(new Set());
      setAttributeEvidence({});
      setCustomInstruction("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose]);

  const selectedCharacter = useMemo(() => {
    return characters.find((char) => char.name === selectedCharacterName);
  }, [characters, selectedCharacterName]);

  const attributesByKey = useMemo(() => {
    if (!selectedCharacter) return new Map<string, CharacterAttribute>();

    const map = new Map<string, CharacterAttribute>();
    for (const attribute of selectedCharacter.attributes || []) {
      map.set(getAttributeKey(attribute), attribute);
    }
    return map;
  }, [selectedCharacter]);

  const toggleAttribute = (attributeKey: string) => {
    setSelectedAttributes((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(attributeKey);

      if (isSelected) {
        next.delete(attributeKey);
        setAttributeEvidence((prevEvidence) => {
          const { [attributeKey]: _removed, ...rest } = prevEvidence;
          return rest;
        });
      } else {
        next.add(attributeKey);
        setAttributeEvidence((prevEvidence) => {
          if (prevEvidence[attributeKey]) return prevEvidence;
          return {
            ...prevEvidence,
            [attributeKey]: new Set<IndicatorType>(),
          };
        });
      }

      return next;
    });
  };

  const toggleEvidenceType = (
    attributeKey: string,
    evidenceType: IndicatorType,
  ) => {
    setAttributeEvidence((prev) => {
      const existing = prev[attributeKey] ?? new Set<IndicatorType>();
      const next = new Set(existing);
      if (next.has(evidenceType)) {
        next.delete(evidenceType);
      } else {
        next.add(evidenceType);
      }
      return {
        ...prev,
        [attributeKey]: next,
      };
    });
  };

  const handleSubmit = () => {
    if (!selectedCharacter) return;
    const attributes: AttributeEvidenceSelection[] = [];

    for (const attributeKey of selectedAttributes) {
      const attribute = attributesByKey.get(attributeKey);
      if (!attribute) continue;
      const evidence = attributeEvidence[attributeKey];
      if (!evidence || evidence.size === 0) continue;
      const snippets = attribute.evidence.filter((item) =>
        evidence.has(item.indicatorType),
      );

      attributes.push({
        name: attribute.name,
        category: attribute.category,
        evidenceTypes: Array.from(evidence),
        evidenceSnippets: snippets.map((item) => ({
          indicatorType: item.indicatorType,
          text: item.text,
        })),
      });
    }

    if (attributes.length === 0) return;

    onSubmit({
      characterName: selectedCharacter.name,
      attributes,
      instruction: customInstruction.trim(),
    });
  };

  if (!isOpen || !position) return null;

  const isSubmitDisabled =
    !selectedCharacter ||
    selectedAttributes.size === 0 ||
    Array.from(selectedAttributes).some((attributeKey) => {
      const evidenceCount = attributeEvidence[attributeKey]?.size ?? 0;
      return evidenceCount === 0 || !attributesByKey.has(attributeKey);
    });

  return (
    <div
      ref={containerRef}
      className="fixed z-[2000] w-80 rounded border border-zinc-200 bg-white shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            Continue Story with Evidence
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <TbX size={16} />
        </button>
      </div>

      <div className="max-h-[300px] space-y-4 overflow-y-auto px-4 py-4 text-sm">
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            Character
          </label>
          <select
            className="select select-bordered select-sm w-full"
            value={selectedCharacterName}
            onChange={(event) => {
              const nextName = event.target.value;
              setSelectedCharacterName(nextName);
              setSelectedAttributes(new Set());
              setAttributeEvidence({});
            }}
          >
            <option value="">Select a character…</option>
            {characters.map((character) => (
              <option key={character.name} value={character.name}>
                {character.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            Custom instruction{" "}
            <span className="text-zinc-400 lowercase">(optional)</span>
          </label>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            rows={3}
            placeholder="E.g. focus on a tense standoff or mention the storm outside…"
            value={customInstruction}
            onChange={(event) => setCustomInstruction(event.target.value)}
          />
        </div>

        {selectedCharacter && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              Attributes
            </label>
            {selectedCharacter.attributes.length === 0 ? (
              <p className="rounded border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500">
                No attributes found for this character yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedCharacter.attributes.map((attribute) => {
                  const key = getAttributeKey(attribute);
                  const isChecked = selectedAttributes.has(key);
                  const selectedEvidence = attributeEvidence[key]?.size ?? 0;
                  return (
                    <li
                      key={key}
                      className="rounded border border-zinc-200 p-2"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={isChecked}
                          onChange={() => toggleAttribute(key)}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-zinc-900">
                                {attribute.name}
                              </p>
                              {/* <p className="text-xs text-zinc-500">
                                {ATTRIBUTE_CATEGORY_LABELS[attribute.category]}
                              </p> */}
                            </div>
                            {/* <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                              {attribute.evidence.length} evidence
                            </span> */}
                          </div>

                          {isChecked && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-zinc-500">
                                Evidence types
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {EVIDENCE_TYPES.map((type) => (
                                  <label
                                    key={`${attribute.name}-${type}`}
                                    className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                                      isChecked
                                        ? "border-zinc-200 text-zinc-600"
                                        : "border-transparent text-zinc-400"
                                    } ${
                                      isChecked
                                        ? "hover:border-blue-400 hover:text-blue-600"
                                        : "cursor-not-allowed opacity-60"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!isChecked}
                                      checked={
                                        isChecked &&
                                        attributeEvidence[key]?.has(type)
                                          ? true
                                          : false
                                      }
                                      onChange={() =>
                                        toggleEvidenceType(key, type)
                                      }
                                    />
                                    {EVIDENCE_TYPE_LABELS[type]}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {isChecked && selectedEvidence === 0 && (
                            <p className="text-xs text-amber-600">
                              Select at least one evidence type.
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onClose}
          disabled={isGenerating}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-sm btn-neutral"
          disabled={isSubmitDisabled || isGenerating}
          onClick={handleSubmit}
        >
          {isGenerating ? "Generating…" : "Generate Sentence"}
        </button>
      </div>
    </div>
  );
}

export default SlashCommandMenu;
