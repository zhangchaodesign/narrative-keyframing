"use client";

import { useCallback } from "react";
import { TbPlayerPlay } from "react-icons/tb";

type NarrativeMenuProps = {
  nodeId: string;
};

export function NarrativeMenu({ nodeId }: NarrativeMenuProps) {
  const handleRun = useCallback(() => {
    // Empty run function - to be implemented later
    console.log("Run narrative generation for:", nodeId);
  }, [nodeId]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRun}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        title="Generate third-person narration"
        aria-label="Generate third-person narration"
      >
        <TbPlayerPlay size={12} />
      </button>
    </div>
  );
}
