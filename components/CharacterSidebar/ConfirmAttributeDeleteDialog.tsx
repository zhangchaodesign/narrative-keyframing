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
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="border-b px-5 py-3">
          <h2 className="text-base font-semibold text-gray-800">
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
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={cn(
                "rounded bg-red-600 px-3 py-2 text-sm font-medium text-white transition",
                isProcessing ? "opacity-60" : "hover:bg-red-700",
              )}
            >
              Delete attribute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
