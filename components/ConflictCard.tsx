import { type AttributeConflict } from "@/lib/types/conflicts";

interface ConflictCardProps {
  conflict: AttributeConflict;
  onClick: () => void;
  isSelected: boolean;
}

export function ConflictCard({
  conflict,
  onClick,
  isSelected,
}: ConflictCardProps) {
  return (
    <div
      className={`p-3 bg-red-50 border-2 rounded shadow hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "border-red-600 ring-4 ring-red-300" : "border-red-300"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`px-2 py-0.5 rounded text-white text-[10px] font-semibold ${
            conflict.severity === "high"
              ? "bg-red-600"
              : conflict.severity === "medium"
              ? "bg-orange-500"
              : "bg-yellow-500"
          }`}
        >
          {conflict.severity.toUpperCase()}
        </span>
        <span className="text-xs text-gray-600 font-semibold">
          {conflict.category}
        </span>
      </div>
      <p className="text-sm text-gray-800 mb-1">
        Established:{" "}
        <span className="font-semibold">
          "{conflict.establishedAttribute.name}"
        </span>
      </p>
      <p className="text-xs text-gray-600 italic mb-2">
        {conflict.explanation}
      </p>
      <div className="text-[10px] text-gray-500 space-y-1">
        <p>Original: "{conflict.establishedAttribute.evidence.text}"</p>
        <p className="text-red-600 font-medium">
          Conflicts with: "{conflict.conflictingEvidence.text}"
        </p>
      </div>
    </div>
  );
}
