"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/utils";

type AttributeStoryUpdateDialogProps = {
  isOpen: boolean;
  originalName: string;
  onCancel: () => void;
  onSubmit: (payload: { newName: string; updateStory: boolean }) => void;
  isProcessing?: boolean;
  error?: string | null;
};

const updateOptions = [
  { label: "Yes, update the story", value: true },
  { label: "No, keep the story as-is", value: false },
];

export function AttributeStoryUpdateDialog({
  isOpen,
  originalName,
  onCancel,
  onSubmit,
  isProcessing = false,
  error,
}: AttributeStoryUpdateDialogProps) {
  const [newName, setNewName] = useState(originalName);
  const [updateStory, setUpdateStory] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewName(originalName);
      setUpdateStory(true);
      setTouched(false);
    }
  }, [isOpen, originalName]);

  const trimmedName = useMemo(() => newName.trim(), [newName]);
  const showValidation = touched && trimmedName.length === 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded border border-zinc-200 bg-white shadow-lg">
        <div className="border-b border-zinc-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Rename Attribute
          </h2>
          {/* <p className="mt-1 text-sm text-gray-500">
            Update the attribute name and choose whether to revise the story to
            reflect this change.
          </p> */}
        </div>
        <form
          className="space-y-5 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!trimmedName) return;
            onSubmit({ newName: trimmedName, updateStory });
          }}
        >
          <div className="space-y-2">
            <label
              htmlFor="attribute-name"
              className="block text-xs font-semibold uppercase text-zinc-500"
            >
              Attribute Name
            </label>
            <input
              id="attribute-name"
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onBlur={() => setTouched(true)}
              disabled={isProcessing}
              className="input w-full"
              placeholder="e.g. Disciplined"
              autoFocus
            />
            {showValidation && (
              <p className="mt-1 text-xs text-red-500">
                Attribute name cannot be empty.
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-xs font-semibold uppercase text-zinc-500">
              Update Story?
            </legend>
            <div className="grid gap-2">
              {updateOptions.map((option) => (
                <label
                  key={option.value ? "update-story" : "leave-story"}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm transition",
                    updateStory === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/60",
                  )}
                >
                  <span>{option.label}</span>
                  <input
                    type="radio"
                    name="update-story"
                    value={option.value ? "yes" : "no"}
                    checked={updateStory === option.value}
                    onChange={() => setUpdateStory(option.value)}
                    disabled={isProcessing}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-zinc-200 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="btn btn-sm btn-ghost rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || trimmedName.length === 0}
              className="btn btn-sm btn-neutral rounded"
            >
              {isProcessing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
