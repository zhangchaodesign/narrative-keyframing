"use client";

type NarrativePromptDialogProps = {
  isOpen: boolean;
  customPrompt: string;
  isRegenerating: boolean;
  onChangePrompt: (nextPrompt: string) => void;
  onCancel: () => void;
  onRegenerate: () => void;
};

export function NarrativePromptDialog({
  isOpen,
  customPrompt,
  isRegenerating,
  onChangePrompt,
  onCancel,
  onRegenerate,
}: NarrativePromptDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded bg-white p-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Custom Prompt (Optional)</legend>
          <textarea
            value={customPrompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            placeholder="E.g., Focus on emotional depth, use vivid imagery..."
            rows={4}
            className="textarea w-full rounded text-xs"
          />
        </fieldset>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-sm">
            Cancel
          </button>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="btn btn-sm btn-neutral"
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}
