"use client";

import React from "react";
import { cn } from "@/lib/utils/utils";

type ConfirmAttributeDeleteDialogProps = {
  isOpen: boolean;
  attributeName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing?: boolean;
};

export function ConfirmAttributeDeleteDialog({
  isOpen,
  attributeName,
  onCancel,
  onConfirm,
  isProcessing = false,
}: ConfirmAttributeDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded border border-zinc-200 bg-white shadow-lg">
        <div className="border-b border-zinc-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Remove Attribute
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm text-gray-700">
          <p>
            Are you sure you want to delete the attribute{" "}
            <span className="font-semibold text-gray-900">
              "{attributeName}"
            </span>
            ? This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-2 border-zinc-200 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="btn btn-sm btn-neutral"
            >
              Delete attribute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
