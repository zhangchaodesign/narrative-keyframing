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
import type { PerspectiveEvidenceItem } from "@/lib/types/workflow";
import { findTextMatches } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { cn, eventTracker } from "@/lib/utils";

interface PerspectiveContentProps {
  perspectiveNodeId: string;
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
  isEditing?: boolean;
  onReflectionChange?: (newReflection: string) => void;
  classes?: string;
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
    const charColors = range.snippet.characterName
      ? getCharacterColors(range.snippet.characterName)
      : null;
    const selectedHighlight = charColors?.highlight ?? "bg-blue-400";
    const selectedBorder = charColors?.border ?? "border-blue-400";

    segments.push(
      <mark
        key={`segment-${index}-highlight`}
        onClick={() => onToggleSnippet(range.snippet)}
        className={`cursor-pointer rounded px-0.5 py-0.5 transition-colors ${
          isSelected
            ? `${selectedHighlight} text-gray-900 border ${selectedBorder}`
            : "bg-blue-100 text-gray-900 hover:bg-blue-300"
        }`}
        title={`Click to ${
          isSelected ? "deselect" : "select"
        } snippet for story generation${range.snippet.characterName ? ` (${range.snippet.characterName})` : ""}`}
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
  classes,
}: PerspectiveContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editValue, setEditValue] = useState(reflection);

  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const selectedSnippets = useWorkflowStore((state) => state.selectedSnippets);
  const toggleSnippet = useWorkflowStore((state) => state.toggleSnippet);
  const workflowNodes = useWorkflowStore((state) => state.nodes);

  // Get the parent group ID of this perspective node to filter character selections
  const perspectiveParentId = useMemo(() => {
    if (!workflowNodes || workflowNodes.length === 0) {
      return undefined;
    }
    const perspectiveNode = workflowNodes.find(
      (node) => node.id === perspectiveNodeId,
    );
    return perspectiveNode?.parentId;
  }, [workflowNodes, perspectiveNodeId]);

  // Get character nodes in this group to check their parentId
  const characterNodesInGroup = useMemo(() => {
    if (!workflowNodes || !perspectiveParentId) {
      return new Set<string>();
    }

    const characterIds = new Set<string>();
    workflowNodes.forEach((node) => {
      if (node.type === "character" && node.parentId === perspectiveParentId) {
        characterIds.add(node.id);
      }
    });
    return characterIds;
  }, [workflowNodes, perspectiveParentId]);

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
      const snippetKey = buildSnippetKey(
        snippet.perspectiveNodeId,
        snippet.text,
      );
      const isCurrentlySelected = Boolean(selectedSnippets[snippetKey]);

      eventTracker({
        action: isCurrentlySelected
          ? "deselect_perspective_text"
          : "select_perspective_text",
        data: {
          perspectiveNodeId: snippet.perspectiveNodeId,
          perspectiveContent: reflection,
          characterId: snippet.characterId,
          characterName: snippet.characterName ?? null,
          snippetText: snippet.text,
          attributes: snippet.attributes ?? [],
        },
      });

      toggleSnippet(snippet);
    },
    [perspectiveNodeId, selectedSnippets, toggleSnippet],
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
  ]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={handleTextChange}
        className={cn(
          "flex-1 w-full resize-none rounded bg-white border border-gray-300 px-2 py-1 leading-snug text-gray-800 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 nodrag nopan",
          classes,
        )}
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
      className={cn(
        "flex-1 overflow-y-auto w-full resize-none rounded bg-gray-50 px-2 py-1 leading-snug whitespace-pre-wrap text-gray-800",
        classes,
      )}
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
