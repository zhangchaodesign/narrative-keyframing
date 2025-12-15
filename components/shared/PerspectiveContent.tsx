import {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import {
  buildEvidenceAttributeKey,
  buildSnippetKey,
  useWorkflowStore,
  type SelectedSnippet,
} from "@/lib/stores/workflowStore";
import type {
  PerspectiveEvidenceItem,
  WorkflowNode,
} from "@/lib/types/workflow";
import { findTextMatches } from "@/lib/utils";

interface PerspectiveContentProps {
  perspectiveNodeId: string;
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
  isEditing?: boolean;
  onReflectionChange?: (newReflection: string) => void;
  nodes: WorkflowNode[];
  variant?: "node" | "block";
}

type SnippetRange = {
  start: number;
  end: number;
  snippet: SelectedSnippet;
};

function createHighlightedSegments(
  text: string,
  ranges: SnippetRange[],
  selectedSnippets: Record<string, SelectedSnippet>,
  perspectiveNodeId: string,
  onToggleSnippet: (snippet: SelectedSnippet) => void,
): ReactNode[] {
  if (ranges.length === 0) {
    return [text];
  }

  // Sort and merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: SnippetRange[] = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
      // Keep the snippet info from the longer range
      last.snippet = range.snippet;
    }
  });

  // Generate segments with highlights
  const segments: ReactNode[] = [];
  let cursor = 0;

  merged.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push(
        <span key={`segment-${index}-text`}>
          {text.slice(cursor, range.start)}
        </span>,
      );
    }

    const snippetKey = buildSnippetKey(perspectiveNodeId, range.snippet.text);
    const isSelected = Boolean(selectedSnippets[snippetKey]);

    segments.push(
      <mark
        key={`segment-${index}-highlight`}
        onClick={() => onToggleSnippet(range.snippet)}
        className={`cursor-pointer rounded px-0.5 py-0.5 transition-colors ${
          isSelected
            ? "bg-blue-400 text-white ring-2 ring-blue-600"
            : "bg-yellow-200 text-zinc-900 hover:bg-yellow-300"
        }`}
        title={`Click to ${
          isSelected ? "deselect" : "select"
        } snippet for story generation`}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });

  if (cursor < text.length) {
    segments.push(<span key="segment-tail">{text.slice(cursor)}</span>);
  }

  return segments;
}

export function PerspectiveContent({
  perspectiveNodeId,
  reflection,
  analysisEvidence,
  isEditing = false,
  onReflectionChange,
  nodes,
  variant = "node",
}: PerspectiveContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editValue, setEditValue] = useState(reflection);

  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const toggleSnippet = useWorkflowStore((state) => state.toggleSnippet);

  // Get the parent group ID of this perspective node to filter character selections
  const perspectiveNode = nodes.find(
    (node) => node.id === perspectiveNodeId,
  );
  const perspectiveParentId = perspectiveNode?.parentId;

  // Get character nodes in this group to check their parentId
  const characterNodesInGroup = useMemo(() => {
    if (!perspectiveParentId) return new Set<string>();

    const characterIds = new Set<string>();
    nodes.forEach((node) => {
      if (node.type === "character" && node.parentId === perspectiveParentId) {
        characterIds.add(node.id);
      }
    });
    return characterIds;
  }, [nodes, perspectiveParentId]);

  // Update edit value when reflection changes externally
  useEffect(() => {
    setEditValue(reflection);
  }, [reflection]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleToggleSnippet = useCallback(
    (snippet: SelectedSnippet) => {
      toggleSnippet(snippet);
    },
    [toggleSnippet],
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setEditValue(newValue);
      onReflectionChange?.(newValue);
    },
    [onReflectionChange],
  );

  const highlightedReflection = useMemo<ReactNode>(() => {
    const reflectionText = reflection ?? "";
    if (!reflectionText) {
      return null;
    }

    // 1. Gather all evidence items based on selected attributes
    const analysisItems = analysisEvidence ?? [];
    const activeKeys = selectedEvidenceAttributes;
    if (
      analysisItems.length === 0 ||
      !activeKeys ||
      Object.keys(activeKeys).length === 0 ||
      !perspectiveParentId
    ) {
      return reflectionText;
    }

    // 2. Find all matching text ranges with snippet metadata
    const ranges: SnippetRange[] = [];

    analysisItems.forEach((entry) => {
      const characterId = entry.characterId;
      const characterName = entry.characterName;

      // Only highlight if the character belongs to this perspective's group
      if (!characterNodesInGroup.has(characterId)) {
        return;
      }

      entry.items.forEach((item) => {
        const shouldHighlight = item.attributes.some((attribute) =>
          Boolean(
            activeKeys[buildEvidenceAttributeKey(characterId, attribute)],
          ),
        );

        if (!shouldHighlight) {
          return;
        }

        const snippet = item.text;
        const matches = findTextMatches(reflectionText, snippet);

        // Create snippet metadata for each match
        const snippetData: SelectedSnippet = {
          perspectiveNodeId,
          text: snippet,
          characterId,
          characterName,
          attributes: item.attributes,
        };

        ranges.push(
          ...matches.map((match) => ({
            ...match,
            snippet: snippetData,
          })),
        );
      });
    });

    // 3. Create highlighted segments (handles sorting, merging, and rendering)
    return createHighlightedSegments(
      reflectionText,
      ranges,
      selectedSnippets,
      perspectiveNodeId,
      handleToggleSnippet,
    );
  }, [
    analysisEvidence,
    reflection,
    selectedEvidenceAttributes,
    selectedSnippets,
    perspectiveNodeId,
    characterNodesInGroup,
    handleToggleSnippet,
    perspectiveParentId,
  ]);

  // Variant-specific styles
  const textSize = variant === "block" ? "text-[11px]" : "text-[10px]";
  const marginTop = variant === "block" ? "mt-2" : "";
  const placeholder = variant === "block" ? "Write the reflection..." : undefined;
  const textareaBg = variant === "block" ? "bg-white/80 focus:bg-white" : "bg-white";

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        onPointerDown={(event) => event.stopPropagation()}
        className={`${marginTop} w-full flex-1 resize-none rounded border border-zinc-300 ${textareaBg} px-2 py-1 ${textSize} leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 nodrag nopan`}
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
        onWheelCapture={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
      />
    );
  }

  return (
    <div
      className={`${marginTop} flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 ${textSize} leading-snug text-zinc-800 nodrag nopan`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => {
        if (event.ctrlKey || event.metaKey) {
          return;
        }
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
      }}
      onWheelCapture={(event) => {
        if (event.ctrlKey || event.metaKey) {
          return;
        }
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
      }}
    >
      {highlightedReflection}
    </div>
  );
}
