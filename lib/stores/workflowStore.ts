import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";

import {
  initialEdges,
  initialNodes,
} from "@/components/WorkflowCanvas/workflow.constants";
import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  GroupNodeData,
  NarrativeNodeType,
  PerspectiveGroupNodeType,
  PerspectiveNodeType,
  ThirdPersonGroupNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import type { NarrativeEventData } from "@/lib/types/narrative";
import {
  TRAIT_CATEGORIES,
  type CharacterAttributePayload,
  type CharacterEvidenceTarget,
  type CharacterSnapshotPayload,
  type PerspectiveEvidenceTarget,
  type PerspectivePreparationResult,
  type PerspectiveTaskPayload,
} from "@/lib/types/perspective";
import {
  cloneData,
  generateUniqueUuidId,
  sortEventsByTimeline,
} from "@/lib/utiils/workflowUtils";

type StateUpdater<T> = T | ((state: T) => T);

export const buildEvidenceAttributeKey = (
  characterId: string,
  attribute: string,
) => `${characterId}::${attribute.trim().toLowerCase()}`;

export const buildSnippetKey = (
  perspectiveNodeId: string,
  snippetText: string,
) => `${perspectiveNodeId}::${snippetText.trim()}`;

export type SelectedSnippet = {
  perspectiveNodeId: string;
  text: string;
  characterId: string;
  characterName: string;
  attributes: string[];
};

export type ExtractedCharacter = {
  name: string;
  role: string;
};

type WorkflowState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedEvidenceAttributes: Record<string, boolean>;
  selectedSnippets: Record<string, SelectedSnippet>;
  extractedCharacters: Record<string, ExtractedCharacter[]>;
  setNodes: (updater: StateUpdater<WorkflowNode[]>) => void;
  setEdges: (updater: StateUpdater<WorkflowEdge[]>) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  toggleEvidenceAttribute: (characterId: string, attribute: string) => void;
  clearEvidenceAttribute: (characterId: string, attribute: string) => void;
  clearAllEvidenceAttributes: () => void;
  toggleSnippet: (snippet: SelectedSnippet) => void;
  clearSnippet: (perspectiveNodeId: string, snippetText: string) => void;
  clearAllSnippets: () => void;
  setExtractedCharacters: (
    eventGroupId: string,
    characters: ExtractedCharacter[],
  ) => void;
  getPerspectiveEvidenceTarget: (
    perspectiveId: string,
  ) => PerspectiveEvidenceTarget | null;
  getPerspectiveEvidenceTargets: (
    perspectiveIds: string[],
  ) => Array<{ nodeId: string; target: PerspectiveEvidenceTarget }>;
  preparePerspectiveGeneration: (
    targetNodeIds?: string[],
  ) => PerspectivePreparationResult | null;
  duplicateNarrativeGroup: (groupId: string) => void;
  getNarrativeEventsData: (groupId: string) => NarrativeEventData[];
  reset: () => void;
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const ATTRIBUTE_HANDLE_PATTERN = /-(physiology|psychology|sociology)-/;
const STORAGE_VERSION = 5;

/**
 * Create a throttled storage wrapper to prevent excessive localStorage writes
 * during rapid state updates (e.g., dragging nodes).
 * Batches writes to occur at most once every 100ms.
 */
const createThrottledStorage = () => {
  let pendingWrite: { key: string; value: string } | null = null;
  let writeTimeout: ReturnType<typeof setTimeout> | null = null;
  const THROTTLE_MS = 100;

  const flushPendingWrite = () => {
    if (pendingWrite) {
      try {
        localStorage.setItem(pendingWrite.key, pendingWrite.value);
      } catch (error) {
        console.error("Failed to persist workflow state:", error);
      }
      pendingWrite = null;
      writeTimeout = null;
    }
  };

  return {
    getItem: (key: string) => {
      // Flush any pending write before reading to ensure consistency
      flushPendingWrite();
      const value = localStorage.getItem(key);
      return value;
    },
    setItem: (key: string, value: string) => {
      // Store the pending write
      pendingWrite = { key, value };

      // Clear existing timeout
      if (writeTimeout !== null) {
        clearTimeout(writeTimeout);
      }

      // Schedule the write
      writeTimeout = setTimeout(flushPendingWrite, THROTTLE_MS);
    },
    removeItem: (key: string) => {
      // Immediate removal, no throttling
      flushPendingWrite();
      localStorage.removeItem(key);
    },
  };
};

const sanitizeEdges = (edges: WorkflowEdge[]): WorkflowEdge[] =>
  edges.filter((edge) => {
    const sourceHandle = edge.sourceHandle ?? "";
    const targetHandle = edge.targetHandle ?? "";
    return (
      !ATTRIBUTE_HANDLE_PATTERN.test(sourceHandle) &&
      !ATTRIBUTE_HANDLE_PATTERN.test(targetHandle) &&
      sourceHandle !== "event" &&
      targetHandle !== "event"
    );
  });

const buildCharacterNodeData = (
  currentData: CharacterNodeType["data"] | undefined,
  perspectiveId: string,
): CharacterNodeType["data"] => {
  const baseTraits = currentData?.traits ?? {
    physiology: [],
    psychology: [],
    sociology: [],
  };

  return {
    ...(currentData ?? {
      name: "",
      traits: baseTraits,
      perspectiveId: "",
    }),
    traits: baseTraits,
    perspectiveId,
  };
};

// Keep each character node's perspectiveId in sync with the actual edges that
// connect characters to perspective nodes so UI affordances stay accurate.
const synchronizeCharacterPerspectiveLinks = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  if (!edges || edges.length === 0) {
    let changed = false;
    const detachedNodes = nodes.map((node) => {
      if (node.type !== "character") {
        return node;
      }

      const currentData = node.data as CharacterNodeType["data"] | undefined;
      const currentPerspectiveId = currentData?.perspectiveId ?? "";
      const shouldBeDraggable = true;
      const shouldClampToParent: CharacterNodeType["extent"] = undefined;
      if (
        currentPerspectiveId === "" &&
        node.draggable === shouldBeDraggable &&
        node.extent === shouldClampToParent
      ) {
        return node;
      }

      changed = true;

      return {
        ...node,
        data: buildCharacterNodeData(currentData, ""),
        draggable: shouldBeDraggable,
        extent: shouldClampToParent,
      };
    });

    return changed ? detachedNodes : nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const perspectiveParentLookup = new Map(
    nodes
      .filter(
        (node): node is PerspectiveNodeType => node.type === "perspective",
      )
      .map((node) => [node.id, node.parentId]),
  );
  const characterAssignments = new Map<string, string>();

  edges.forEach((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode.type === "character" && targetNode.type === "perspective") {
      characterAssignments.set(sourceNode.id, targetNode.id);
      return;
    }

    if (sourceNode.type === "perspective" && targetNode.type === "character") {
      characterAssignments.set(targetNode.id, sourceNode.id);
    }
  });

  let updated = false;

  const normalizedNodes = nodes.map((node) => {
    if (node.type !== "character") {
      return node;
    }

    const targetPerspectiveId = characterAssignments.get(node.id) ?? "";
    const currentData = node.data as CharacterNodeType["data"] | undefined;
    const currentPerspectiveId = currentData?.perspectiveId ?? "";
    const shouldBeDraggable = targetPerspectiveId === "";
    const targetParentId =
      targetPerspectiveId === ""
        ? node.parentId
        : (perspectiveParentLookup.get(targetPerspectiveId) ?? node.parentId);
    const targetExtent: CharacterNodeType["extent"] =
      targetPerspectiveId === "" ? undefined : "parent";

    if (
      currentPerspectiveId === targetPerspectiveId &&
      node.draggable === shouldBeDraggable &&
      node.parentId === targetParentId &&
      node.extent === targetExtent
    ) {
      return node;
    }

    updated = true;

    return {
      ...node,
      data: buildCharacterNodeData(currentData, targetPerspectiveId),
      draggable: shouldBeDraggable,
      parentId: targetParentId,
      extent: targetExtent,
    };
  });

  return updated ? normalizedNodes : nodes;
};

const synchronizePerspectiveGroupEventLinks = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  const perspectiveGroups = nodes.filter(
    (node): node is PerspectiveGroupNodeType =>
      node.type === "perspectiveGroup",
  );
  if (perspectiveGroups.length === 0) {
    return nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const eventGroupMetadata = new Map(
    nodes
      .filter((node) => node.type === "eventGroup")
      .map((node) => {
        const data = node.data as {
          label?: string;
          eventGroupId?: number;
        };
        return [
          node.id,
          {
            id: node.id,
            label: data?.label,
            eventGroupId: data?.eventGroupId,
          },
        ];
      }),
  );

  const perspectiveGroupConnections = new Map<string, string>();

  edges.forEach((edge) => {
    if (
      edge.sourceHandle !== "group-bridge" ||
      edge.targetHandle !== "group-bridge"
    ) {
      return;
    }

    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (
      sourceNode.type === "eventGroup" &&
      targetNode.type === "perspectiveGroup"
    ) {
      perspectiveGroupConnections.set(targetNode.id, sourceNode.id);
      return;
    }

    if (
      sourceNode.type === "perspectiveGroup" &&
      targetNode.type === "eventGroup"
    ) {
      perspectiveGroupConnections.set(sourceNode.id, targetNode.id);
    }
  });

  let changed = false;

  const updatedNodes = nodes.map((node) => {
    if (node.type !== "perspectiveGroup") {
      return node;
    }

    const currentData = (node.data ?? {}) as PerspectiveGroupNodeType["data"];
    const existingConnected = currentData.connectedEventGroup;

    const connectedEventGroupId = perspectiveGroupConnections.get(node.id);
    const eventGroupData = connectedEventGroupId
      ? eventGroupMetadata.get(connectedEventGroupId)
      : undefined;

    if (!eventGroupData) {
      if (!existingConnected) {
        return node;
      }

      const { connectedEventGroup: _removed, ...restData } =
        currentData as Record<string, unknown>;
      changed = true;
      return {
        ...node,
        data: restData as PerspectiveGroupNodeType["data"],
      };
    }

    if (
      existingConnected &&
      existingConnected.id === eventGroupData.id &&
      existingConnected.label === eventGroupData.label &&
      existingConnected.eventGroupId === eventGroupData.eventGroupId
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      data: {
        ...currentData,
        connectedEventGroup: eventGroupData,
      },
    };
  });

  return changed ? updatedNodes : nodes;
};

const synchronizeNarrativeGroupEventLinks = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  const narrativeGroups = nodes.filter(
    (node): node is ThirdPersonGroupNodeType => node.type === "narrativeGroup",
  );
  if (narrativeGroups.length === 0) {
    return nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const perspectiveEventMetadata = new Map(
    nodes
      .filter(
        (node): node is PerspectiveGroupNodeType =>
          node.type === "perspectiveGroup",
      )
      .map((node) => [
        node.id,
        (node.data as PerspectiveGroupNodeType["data"])?.connectedEventGroup,
      ]),
  );

  const narrativeAssignments = new Map<
    string,
    PerspectiveGroupNodeType["data"]["connectedEventGroup"]
  >();
  const narrativeConnectedEventGroups = new Map<
    string,
    Array<PerspectiveGroupNodeType["data"]["connectedEventGroup"] | undefined>
  >();

  const registerConnection = (
    narrativeGroupId: string,
    perspectiveGroupId: string,
  ) => {
    const connectedEventGroup =
      perspectiveEventMetadata.get(perspectiveGroupId);
    const currentConnections =
      narrativeConnectedEventGroups.get(narrativeGroupId) ?? [];
    currentConnections.push(connectedEventGroup);
    narrativeConnectedEventGroups.set(narrativeGroupId, currentConnections);

    narrativeAssignments.set(narrativeGroupId, connectedEventGroup);
  };

  edges.forEach((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (
      edge.sourceHandle === "narrative-bridge" &&
      edge.targetHandle === "group-bridge" &&
      sourceNode.type === "perspectiveGroup" &&
      targetNode.type === "narrativeGroup"
    ) {
      registerConnection(targetNode.id, sourceNode.id);
      return;
    }

    if (
      edge.targetHandle === "narrative-bridge" &&
      edge.sourceHandle === "group-bridge" &&
      targetNode.type === "perspectiveGroup" &&
      sourceNode.type === "narrativeGroup"
    ) {
      registerConnection(sourceNode.id, targetNode.id);
    }
  });

  if (typeof window !== "undefined") {
    narrativeConnectedEventGroups.forEach((connections, narrativeGroupId) => {
      if (connections.length <= 1) {
        return;
      }

      const normalized = connections.map((entry) => {
        if (!entry) {
          return "NONE";
        }
        return [
          entry.id ?? "",
          entry.label?.trim() ?? "",
          typeof entry.eventGroupId === "number"
            ? entry.eventGroupId.toString()
            : "",
        ]
          .join("::")
          .trim();
      });

      const uniqueValues = new Set(normalized);
      if (uniqueValues.size <= 1) {
        return;
      }

      const narrativeGroupNode = nodeLookup.get(narrativeGroupId);
      const groupLabel =
        narrativeGroupNode?.type === "narrativeGroup"
          ? ((
              (narrativeGroupNode.data ??
                {}) as ThirdPersonGroupNodeType["data"]
            ).label ?? narrativeGroupNode.id)
          : narrativeGroupId;

      window.alert(
        `Narrative cluster "${groupLabel}" is linked to perspective groups with conflicting story outlines. Align their connections before continuing.`,
      );
    });
  }

  let changed = false;

  const updatedNodes = nodes.map((node) => {
    if (node.type !== "narrativeGroup") {
      return node;
    }

    const currentData = (node.data ?? {}) as ThirdPersonGroupNodeType["data"];
    const existingConnected = currentData.connectedEventGroup;
    const nextConnected = narrativeAssignments.get(node.id);

    if (!nextConnected) {
      if (!existingConnected) {
        return node;
      }
      const { connectedEventGroup: _removed, ...restData } =
        currentData as Record<string, unknown>;
      changed = true;
      return {
        ...node,
        data: restData as ThirdPersonGroupNodeType["data"],
      };
    }

    if (
      existingConnected &&
      existingConnected.id === nextConnected?.id &&
      existingConnected.label === nextConnected?.label &&
      existingConnected.eventGroupId === nextConnected?.eventGroupId
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      data: {
        ...currentData,
        connectedEventGroup: nextConnected,
      },
    };
  });

  return changed ? updatedNodes : nodes;
};

/**
 * Apply derived node state by running synchronization functions.
 * WARNING: This is an expensive operation that iterates through all nodes/edges.
 * Should be called only when necessary (e.g., after drag ends, not during dragging).
 */
const applyDerivedNodeState = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  const withCharacterLinks = synchronizeCharacterPerspectiveLinks(nodes, edges);
  const withPerspectiveGroupLinks = synchronizePerspectiveGroupEventLinks(
    withCharacterLinks,
    edges,
  );
  return synchronizeNarrativeGroupEventLinks(withPerspectiveGroupLinks, edges);
};

const getInitialState = () => {
  const nodes = deepClone(initialNodes);
  const edges = sanitizeEdges(deepClone(initialEdges));

  return {
    nodes: applyDerivedNodeState(nodes, edges),
    edges,
    selectedEvidenceAttributes: {},
    selectedSnippets: {},
    extractedCharacters: {},
  };
};

const ensureNarrationGroupCharacterNames = (
  nodes: WorkflowNode[] | undefined,
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  return nodes.map((node) => {
    if (node.type !== "perspectiveGroup") {
      return node;
    }

    const groupData = node.data ?? {};
    const existingName = (
      groupData as { characterName?: string }
    ).characterName?.trim();
    if (existingName && existingName.length > 0) {
      return node;
    }

    const parentId = node.id;
    const fallbackCharacter = nodes.find(
      (candidate): candidate is CharacterNodeType =>
        candidate.parentId === parentId &&
        candidate.type === "character" &&
        Boolean(candidate.data?.name?.trim()),
    );

    const fallbackNameFromCharacter = fallbackCharacter?.data?.name?.trim();

    const fallbackPerspective = nodes.find(
      (candidate): candidate is PerspectiveNodeType =>
        candidate.parentId === parentId &&
        candidate.type === "perspective" &&
        Boolean(candidate.data?.narrator?.trim()),
    );

    const fallbackName =
      fallbackNameFromCharacter ??
      fallbackPerspective?.data?.narrator?.trim() ??
      "";

    if (!fallbackName) {
      return node;
    }

    return {
      ...node,
      data: {
        ...groupData,
        characterName: fallbackName,
      },
    };
  });
};

const CLONE_OFFSET = 80;

type DuplicateNarrativeGroupResult = {
  newNodes: WorkflowNode[];
  newEdges: WorkflowEdge[];
};

const duplicateNarrativeGroupCluster = (
  groupId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): DuplicateNarrativeGroupResult | null => {
  const groupNode = nodes.find(
    (node) => node.id === groupId && node.type === "narrativeGroup",
  );
  if (!groupNode) {
    return null;
  }

  const narrativeGroups = nodes.filter(
    (node) => node.type === "narrativeGroup",
  );
  const highestNarrativeGroupId = narrativeGroups.reduce(
    (accumulator, node) => {
      const nodeGroupId = node.data?.narrativeGroupId ?? 0;
      return nodeGroupId > accumulator ? nodeGroupId : accumulator;
    },
    0,
  );
  const nextNarrativeGroupId = highestNarrativeGroupId + 1;

  const childNodes = nodes.filter((node) => node.parentId === groupId);
  const clusterNodeIds = new Set<string>([
    groupId,
    ...childNodes.map((n) => n.id),
  ]);

  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const existingEdgeIds = new Set(edges.map((edge) => edge.id));
  const idMap = new Map<string, string>();

  const newGroupId = generateUniqueUuidId("narration-group", existingNodeIds);
  existingNodeIds.add(newGroupId);
  idMap.set(groupId, newGroupId);

  const clonedGroupData = cloneData(groupNode.data) as GroupNodeData;
  const nextGroupData: GroupNodeData = {
    ...clonedGroupData,
    isActiveInEditor: false,
    narrativeGroupId: nextNarrativeGroupId,
  };

  const newGroupNode: WorkflowNode = {
    ...groupNode,
    id: newGroupId,
    position: {
      x: groupNode.position.x + CLONE_OFFSET,
      y: groupNode.position.y + CLONE_OFFSET,
    },
    data: nextGroupData,
    selected: false,
    dragging: false,
  } as WorkflowNode;

  const newChildNodes: WorkflowNode[] = childNodes.map((original) => {
    const prefix =
      original.type === "narrative" ? "narrative" : (original.type ?? "node");
    const newId = generateUniqueUuidId(prefix, existingNodeIds);
    existingNodeIds.add(newId);
    idMap.set(original.id, newId);

    return {
      ...original,
      id: newId,
      parentId: newGroupId,
      position: {
        x: original.position.x,
        y: original.position.y,
      },
      data: cloneData(original.data),
      selected: false,
      dragging: false,
    } as WorkflowNode;
  });

  const newNodes = [newGroupNode, ...newChildNodes];

  const internalEdges = edges.filter(
    (edge) =>
      clusterNodeIds.has(edge.source) && clusterNodeIds.has(edge.target),
  );

  const clonedInternalEdges = internalEdges.map((edge) => {
    const newId = generateUniqueUuidId("edge", existingEdgeIds);
    existingEdgeIds.add(newId);

    return {
      ...edge,
      id: newId,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      data: cloneData(edge.data),
      selected: false,
    };
  });

  return {
    newNodes,
    newEdges: [...clonedInternalEdges],
  };
};

const prepareNarrativeEventsData = (
  groupId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NarrativeEventData[] => {
  const narrativeNodes = nodes.filter(
    (node): node is NarrativeNodeType =>
      node.type === "narrative" && node.parentId === groupId,
  );
  if (narrativeNodes.length === 0) {
    return [];
  }

  const narrativeGroupNode = nodes.find(
    (node): node is ThirdPersonGroupNodeType =>
      node.id === groupId && node.type === "narrativeGroup",
  );
  const connectedEventGroupId =
    narrativeGroupNode?.data?.connectedEventGroup?.id;

  const eventNodes = nodes.filter(
    (node): node is EventNodeType => node.type === "event",
  );
  const eventNodeMap = new Map(
    eventNodes.map((eventNode) => [eventNode.id, eventNode]),
  );
  const eventNodesByGroup = new Map<string, EventNodeType[]>();
  eventNodes.forEach((eventNode) => {
    if (!eventNode.parentId) {
      return;
    }
    const existing = eventNodesByGroup.get(eventNode.parentId) ?? [];
    existing.push(eventNode);
    eventNodesByGroup.set(eventNode.parentId, existing);
  });
  eventNodesByGroup.forEach((events) => {
    events.sort(
      (a, b) =>
        (a.position.x ?? 0) - (b.position.x ?? 0) ||
        (a.position.y ?? 0) - (b.position.y ?? 0),
    );
  });

  const connectedPerspectiveGroupIds = edges
    .filter((edge) => edge.target === groupId)
    .map((edge) => edge.source)
    .filter((sourceId) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      return sourceNode?.type === "perspectiveGroup";
    });

  const linkedPerspectiveNodes = nodes.filter(
    (node): node is PerspectiveNodeType =>
      node.type === "perspective" &&
      node.parentId !== undefined &&
      connectedPerspectiveGroupIds.includes(node.parentId),
  );
  const perspectiveNodesByGroup = new Map<string, PerspectiveNodeType[]>();
  connectedPerspectiveGroupIds.forEach((perspectiveGroupId) => {
    const groupNodes = linkedPerspectiveNodes
      .filter((node) => node.parentId === perspectiveGroupId)
      .sort(
        (a, b) =>
          (a.position.x ?? 0) - (b.position.x ?? 0) ||
          (a.position.y ?? 0) - (b.position.y ?? 0),
      );
    perspectiveNodesByGroup.set(perspectiveGroupId, groupNodes);
  });

  const orderedNarratives = [...narrativeNodes].sort(
    (a, b) =>
      (a.position.x ?? 0) - (b.position.x ?? 0) ||
      (a.position.y ?? 0) - (b.position.y ?? 0),
  );
  const narrativeIndexMap = new Map<string, number>();
  orderedNarratives.forEach((node, index) => {
    narrativeIndexMap.set(node.id, index);
  });

  const groupedEvents = connectedEventGroupId
    ? eventNodesByGroup.get(connectedEventGroupId)
    : undefined;

  return narrativeNodes.map((narrativeNode) => {
    const narrativeIndex = narrativeIndexMap.get(narrativeNode.id) ?? 0;
    let eventNodeForNarrative: EventNodeType | undefined;
    if (groupedEvents && groupedEvents.length > 0) {
      eventNodeForNarrative =
        groupedEvents[Math.min(narrativeIndex, groupedEvents.length - 1)];
    }

    const resolvedEventId = eventNodeForNarrative?.id;
    const eventDescription = eventNodeForNarrative?.data?.description ?? "";
    const eventTimeline = eventNodeForNarrative?.data?.timeline ?? "";

    const perspectiveNodesForEvent: PerspectiveNodeType[] = [];
    connectedPerspectiveGroupIds.forEach((perspectiveGroupId) => {
      const groupNodes = perspectiveNodesByGroup.get(perspectiveGroupId);
      if (!groupNodes || groupNodes.length === 0) {
        return;
      }
      const targetIndex = Math.min(narrativeIndex, groupNodes.length - 1);
      const candidate = groupNodes[targetIndex];
      if (candidate) {
        perspectiveNodesForEvent.push(candidate);
      }
    });

    const snippetsForEvent: NarrativeEventData["snippets"] = [];
    perspectiveNodesForEvent.forEach((pNode) => {
      const evidence = pNode.data?.analysisEvidence || [];
      evidence.forEach((evidenceItem) => {
        evidenceItem.items.forEach((item) => {
          snippetsForEvent.push({
            perspectiveNodeId: pNode.id,
            text: item.text,
            characterId: evidenceItem.characterId,
            characterName: evidenceItem.characterName,
            attributes: item.attributes,
          });
        });
      });
    });

    const perspectivesForEvent = perspectiveNodesForEvent.map((pNode) => ({
      narrator: pNode.data?.narrator || "Unknown narrator",
      reflection: pNode.data?.reflection || "",
    }));

    return {
      narrativeNodeId: narrativeNode.id,
      eventId: resolvedEventId,
      eventDescription,
      eventTimeline,
      snippets: snippetsForEvent,
      perspectives: perspectivesForEvent,
      narration: narrativeNode.data?.narration,
      snippetUsages: narrativeNode.data?.snippetUsages,
    };
  });
};

type PositionedCharacterSnapshot = CharacterSnapshotPayload & {
  positionX: number;
};

const collectCharacterAttributes = (
  traits: CharacterTraits | undefined | null,
): CharacterAttributePayload[] => {
  if (!traits) {
    return [];
  }

  const attributes: CharacterAttributePayload[] = [];
  for (const category of TRAIT_CATEGORIES) {
    const values = traits[category] ?? [];
    if (!Array.isArray(values)) {
      continue;
    }
    values.forEach((rawValue) => {
      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!value) {
        return;
      }
      attributes.push({
        traitCategory: category,
        value,
      });
    });
  }
  return attributes;
};

const buildEvidenceTarget = ({
  node,
  characters,
  groupContext,
}: {
  node: PerspectiveNodeType;
  characters: CharacterEvidenceTarget[];
  groupContext: string;
}): PerspectiveEvidenceTarget => {
  const reflectionRaw = node.data?.reflection;
  const reflection = typeof reflectionRaw === "string" ? reflectionRaw : "";

  return {
    perspectiveId: node.id,
    reflection,
    characters,
    groupContext,
  };
};

const getCharactersForPerspective = ({
  perspectiveId,
  edges,
  characterMap,
}: {
  perspectiveId: string;
  edges: WorkflowEdge[];
  characterMap: Map<string, CharacterNodeType>;
}): CharacterEvidenceTarget[] => {
  const connectedCharacterIds = edges
    .filter(
      (edge) =>
        edge.target === perspectiveId && edge.targetHandle === "character",
    )
    .map((edge) => edge.source);

  if (connectedCharacterIds.length === 0) {
    return [];
  }

  const uniqueCharacterIds = Array.from(new Set(connectedCharacterIds));
  return uniqueCharacterIds
    .map((characterId) => characterMap.get(characterId))
    .filter((node): node is CharacterNodeType => Boolean(node))
    .map((characterNode) => {
      const rawName = characterNode.data?.name;
      const characterName =
        typeof rawName === "string" && rawName.trim().length > 0
          ? rawName.trim()
          : characterNode.id;

      const attributes = collectCharacterAttributes(characterNode.data?.traits);

      return {
        characterId: characterNode.id,
        characterName,
        attributes,
      };
    });
};

const buildGroupContext = (
  perspective: PerspectiveNodeType,
  allPerspectives: PerspectiveNodeType[],
): string => {
  const parentId = perspective.parentId;
  if (!parentId) {
    return "";
  }

  return allPerspectives
    .filter((sibling) => sibling.parentId === parentId)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((sibling) => (sibling.data?.reflection ?? "").trim())
    .filter((reflection) => reflection.length > 0)
    .join("\n\n");
};

const findPerspectiveWithCharacters = ({
  startPerspectiveId,
  direction,
  edges,
  perspectiveMap,
  characterMap,
}: {
  startPerspectiveId: string;
  direction: "previous" | "next";
  edges: WorkflowEdge[];
  perspectiveMap: Map<string, PerspectiveNodeType>;
  characterMap: Map<string, CharacterNodeType>;
}): {
  node: PerspectiveNodeType;
  characters: CharacterEvidenceTarget[];
} | null => {
  const visited = new Set<string>([startPerspectiveId]);
  let currentId = startPerspectiveId;

  while (true) {
    const adjacentIds = edges
      .filter((edge) => {
        if (direction === "previous") {
          return (
            edge.target === currentId &&
            edge.targetHandle === "perspective-prev" &&
            typeof edge.source === "string"
          );
        }
        return (
          edge.source === currentId &&
          edge.sourceHandle === "perspective-next" &&
          typeof edge.target === "string"
        );
      })
      .map((edge) => (direction === "previous" ? edge.source : edge.target))
      .filter((candidateId): candidateId is string => Boolean(candidateId));

    if (adjacentIds.length === 0) {
      return null;
    }

    const nextId = adjacentIds[0]!;
    if (visited.has(nextId)) {
      return null;
    }
    visited.add(nextId);

    const perspectiveNode = perspectiveMap.get(nextId);
    if (!perspectiveNode) {
      currentId = nextId;
      continue;
    }

    const characters = getCharactersForPerspective({
      perspectiveId: perspectiveNode.id,
      edges,
      characterMap,
    });
    if (characters.length > 0) {
      return {
        node: perspectiveNode,
        characters,
      };
    }

    currentId = perspectiveNode.id;
  }
};

const prepareEvidenceAnalysisPayload = (
  perspectiveId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): PerspectiveEvidenceTarget | null => {
  const perspectiveNodes = nodes.filter(
    (node): node is PerspectiveNodeType => node.type === "perspective",
  );
  const characterNodes = nodes.filter(
    (node): node is CharacterNodeType => node.type === "character",
  );

  const perspectiveMap = new Map(
    perspectiveNodes.map((node) => [node.id, node]),
  );
  const characterMap = new Map(characterNodes.map((node) => [node.id, node]));

  const targetPerspective = perspectiveMap.get(perspectiveId);
  if (!targetPerspective) {
    return null;
  }

  const groupContext = buildGroupContext(targetPerspective, perspectiveNodes);

  const primaryCharacters = getCharactersForPerspective({
    perspectiveId,
    edges,
    characterMap,
  });

  if (primaryCharacters.length > 0) {
    return buildEvidenceTarget({
      node: targetPerspective,
      characters: primaryCharacters,
      groupContext,
    });
  }

  const fallbackCharacters: CharacterEvidenceTarget[] = [];

  const previous = findPerspectiveWithCharacters({
    startPerspectiveId: perspectiveId,
    direction: "previous",
    edges,
    perspectiveMap,
    characterMap,
  });
  if (previous) {
    fallbackCharacters.push(...previous.characters);
  }

  const next = findPerspectiveWithCharacters({
    startPerspectiveId: perspectiveId,
    direction: "next",
    edges,
    perspectiveMap,
    characterMap,
  });
  if (next) {
    fallbackCharacters.push(...next.characters);
  }

  if (fallbackCharacters.length === 0) {
    return null;
  }

  return buildEvidenceTarget({
    node: targetPerspective,
    characters: fallbackCharacters,
    groupContext,
  });
};

const buildBatchEvidenceTargets = (
  perspectiveIds: string[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Array<{ nodeId: string; target: PerspectiveEvidenceTarget }> => {
  if (perspectiveIds.length === 0) {
    return [];
  }

  const perspectiveMap = new Map(
    nodes
      .filter(
        (node): node is PerspectiveNodeType => node.type === "perspective",
      )
      .map((node) => [node.id, node]),
  );

  const results: Array<{ nodeId: string; target: PerspectiveEvidenceTarget }> =
    [];

  perspectiveIds.forEach((perspectiveId) => {
    const perspectiveNode = perspectiveMap.get(perspectiveId);
    if (!perspectiveNode) {
      return;
    }

    const perspectiveData = perspectiveNode.data as
      | PerspectiveNodeType["data"]
      | undefined;
    if (
      perspectiveData?.isAnalyzingEvidence ||
      !perspectiveData?.reflection?.trim()
    ) {
      return;
    }

    const target = prepareEvidenceAnalysisPayload(perspectiveId, nodes, edges);
    if (!target || !target.reflection.trim()) {
      return;
    }

    const hasCharacterAttributes = target.characters.some((character) =>
      character.attributes.some(
        (attribute) => attribute.value.trim().length > 0,
      ),
    );
    if (!hasCharacterAttributes) {
      return;
    }

    results.push({ nodeId: perspectiveId, target });
  });

  return results;
};

const preparePerspectiveGenerationPayload = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  targetNodeIds?: string[],
): PerspectivePreparationResult | null => {
  const eventNodes = nodes.filter(
    (node): node is EventNodeType => node.type === "event",
  );
  const perspectiveNodes = nodes.filter(
    (node): node is PerspectiveNodeType => node.type === "perspective",
  );
  const characterNodes = nodes.filter(
    (node): node is CharacterNodeType => node.type === "character",
  );

  const sortedEventNodes = sortEventsByTimeline(eventNodes);
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const perspectiveGroupNodes = nodes.filter(
    (node): node is PerspectiveGroupNodeType =>
      node.type === "perspectiveGroup",
  );
  const perspectiveGroupMap = new Map(
    perspectiveGroupNodes.map((node) => [node.id, node]),
  );
  const perspectiveGroupToEventGroupEdgeMap = new Map<string, string>();

  edges.forEach((edge) => {
    if (
      edge.sourceHandle !== "group-bridge" ||
      edge.targetHandle !== "group-bridge"
    ) {
      return;
    }

    const left =
      typeof edge.source === "string" ? nodeLookup.get(edge.source) : undefined;
    const right =
      typeof edge.target === "string" ? nodeLookup.get(edge.target) : undefined;

    if (left?.type === "perspectiveGroup" && right?.type === "eventGroup") {
      perspectiveGroupToEventGroupEdgeMap.set(left.id, right.id);
      return;
    }

    if (right?.type === "perspectiveGroup" && left?.type === "eventGroup") {
      perspectiveGroupToEventGroupEdgeMap.set(right.id, left.id);
    }
  });

  const eventNodeMap = new Map(
    sortedEventNodes.map((eventNode) => [eventNode.id, eventNode]),
  );
  const eventNodesByGroup = new Map<string, EventNodeType[]>();
  sortedEventNodes.forEach((eventNode) => {
    if (!eventNode.parentId) {
      return;
    }
    const existing = eventNodesByGroup.get(eventNode.parentId) ?? [];
    existing.push(eventNode);
    eventNodesByGroup.set(eventNode.parentId, existing);
  });
  eventNodesByGroup.forEach((events) => {
    events.sort(
      (a, b) =>
        (a.position?.x ?? 0) - (b.position?.x ?? 0) ||
        (a.position?.y ?? 0) - (b.position?.y ?? 0),
    );
  });
  const eventOrderMap = new Map(
    sortedEventNodes.map((eventNode, indexPosition) => [
      eventNode.id,
      indexPosition,
    ]),
  );

  const targetIdSet =
    targetNodeIds && targetNodeIds.length > 0
      ? new Set(targetNodeIds)
      : undefined;

  const relevantPerspectiveNodes = targetIdSet
    ? perspectiveNodes.filter((node) => targetIdSet.has(node.id))
    : perspectiveNodes;

  const relevantEventGroupIds = new Set<string>();

  const getConnectedEventGroupId = (
    perspectiveNode: PerspectiveNodeType,
  ): string | undefined => {
    const perspectiveGroupId = perspectiveNode.parentId;
    if (!perspectiveGroupId) return undefined;

    const perspectiveGroupNode = perspectiveGroupMap.get(perspectiveGroupId);
    const dataConnected = perspectiveGroupNode?.data?.connectedEventGroup?.id;
    if (dataConnected) {
      return dataConnected;
    }

    const edgeConnected =
      perspectiveGroupToEventGroupEdgeMap.get(perspectiveGroupId);
    if (edgeConnected) {
      return edgeConnected;
    }

    return undefined;
  };

  relevantPerspectiveNodes.forEach((perspectiveNode) => {
    const connectedEventGroupId = getConnectedEventGroupId(perspectiveNode);

    if (connectedEventGroupId) {
      relevantEventGroupIds.add(connectedEventGroupId);
    }
  });

  const shouldFilterEvents = relevantEventGroupIds.size > 0;
  const filteredEventNodes = shouldFilterEvents
    ? sortedEventNodes.filter((eventNode) => {
        const belongsToRelevantGroup =
          eventNode.parentId && relevantEventGroupIds.has(eventNode.parentId);
        return Boolean(belongsToRelevantGroup);
      })
    : sortedEventNodes;

  const eventSequence = filteredEventNodes.map((eventNode) => {
    const timeline = eventNode.data?.timeline?.trim();
    const description = eventNode.data?.description?.trim();
    const safeDescription =
      description && description.length > 0
        ? description
        : "No description provided.";

    const label =
      timeline && timeline.length > 0
        ? timeline
        : description && description.length > 0
          ? description
          : eventNode.id;

    return {
      label,
      description: safeDescription,
    };
  });

  const tasksWithOrdering = relevantPerspectiveNodes
    .map((perspectiveNode) => {
      const connectedEventGroupId = getConnectedEventGroupId(perspectiveNode);
      const perspectiveGroupId = perspectiveNode.parentId;

      let eventNode: EventNodeType | null = null;
      if (connectedEventGroupId && perspectiveGroupId) {
        const groupedEvents = eventNodesByGroup.get(connectedEventGroupId);
        if (groupedEvents && groupedEvents.length > 0) {
          const siblingPerspectives = perspectiveNodes
            .filter((node) => node.parentId === perspectiveGroupId)
            .sort(
              (a, b) =>
                (a.position.x ?? 0) - (b.position.x ?? 0) ||
                (a.position.y ?? 0) - (b.position.y ?? 0),
            );
          const siblingIndex = siblingPerspectives.findIndex(
            (node) => node.id === perspectiveNode.id,
          );
          if (siblingIndex >= 0) {
            const targetIndex = Math.min(
              siblingIndex,
              groupedEvents.length - 1,
            );
            eventNode = groupedEvents[targetIndex] ?? null;
          }
        }
      }

      if (!eventNode) {
        return null;
      }

      const eventOrder =
        eventOrderMap.get(eventNode.id) ?? Number.MAX_SAFE_INTEGER;

      const eventLabel =
        eventNode.data?.timeline?.trim() ||
        eventNode.data?.description?.trim() ||
        eventNode.id;
      const rawObjective = eventNode.data?.description?.trim();
      const eventObjective =
        rawObjective && rawObjective.length > 0
          ? rawObjective
          : `Describe what happens during ${eventLabel}.`;

      const fallbackNarratorName =
        perspectiveNode.data?.narrator?.trim() || "Narrator";

      const characterSnapshotsWithPosition: PositionedCharacterSnapshot[] =
        characterNodes
          .filter((characterNode) => {
            const assignedPerspectiveId =
              characterNode.data?.perspectiveId?.trim() ?? "";
            return assignedPerspectiveId === perspectiveNode.id;
          })
          .map((characterNode) => {
            const name = characterNode.data?.name?.trim() || characterNode.id;
            const traits = characterNode.data?.traits ?? {
              physiology: [],
              psychology: [],
              sociology: [],
            };

            return {
              name,
              positionX: characterNode.position.x,
              traits: {
                physiology: traits.physiology ?? [],
                psychology: traits.psychology ?? [],
                sociology: traits.sociology ?? [],
              },
            };
          });

      let characterSnapshots: CharacterSnapshotPayload[] =
        characterSnapshotsWithPosition
          .sort((a, b) => a.positionX - b.positionX)
          .map((snapshot) => {
            const { positionX: _ignore, ...rest } = snapshot;
            return rest;
          });

      if (characterSnapshots.length === 0) {
        characterSnapshots = [
          {
            name: fallbackNarratorName,
            traits: {
              physiology: [],
              psychology: [],
              sociology: [],
            },
          },
        ];
      }

      const narratorName = characterSnapshots[0]?.name || fallbackNarratorName;

      const payload: PerspectiveTaskPayload = {
        id: perspectiveNode.id,
        narrator: narratorName,
        eventLabel,
        eventObjective,
        characterSnapshots,
      };

      return {
        order: eventOrder,
        secondaryOrder: perspectiveNode.position.x,
        task: payload,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        order: number;
        secondaryOrder: number;
        task: PerspectiveTaskPayload;
      } => entry != null,
    );

  if (tasksWithOrdering.length === 0) {
    return null;
  }

  const tasks = tasksWithOrdering
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      if (a.secondaryOrder !== b.secondaryOrder) {
        return a.secondaryOrder - b.secondaryOrder;
      }
      return a.task.id.localeCompare(b.task.id);
    })
    .map((entry) => entry.task);

  return {
    eventSequence,
    tasks,
  };
};

const ENABLE_PERSIST =
  process.env.NEXT_PUBLIC_ENABLE_PERSIST === "true";

const workflowStoreCreator: import("zustand").StateCreator<WorkflowState> = (set, get) => ({
  ...getInitialState(),
  setNodes: (updater) =>
    set((state) => {
      const nextNodes =
        typeof updater === "function"
          ? (updater as (nodes: WorkflowNode[]) => WorkflowNode[])(
              state.nodes,
            )
          : updater;

      return {
        nodes: applyDerivedNodeState(nextNodes, state.edges),
      };
    }),
  setEdges: (updater) =>
    set((state) => {
      const nextEdges = sanitizeEdges(
        typeof updater === "function"
          ? (updater as (edges: WorkflowEdge[]) => WorkflowEdge[])(
              state.edges,
            )
          : updater,
      );

      const nextNodes = applyDerivedNodeState(state.nodes, nextEdges);

      return {
        edges: nextEdges,
        nodes: nextNodes,
      };
    }),
  onNodesChange: (changes) =>
    set((state) => {
      // Performance optimization: Skip expensive synchronization during drag operations
      // If ANY change is a position update with dragging=true, we're in the middle of a drag
      const isDragging = changes.some(
        (change) =>
          change.type === "position" &&
          "dragging" in change &&
          change.dragging === true,
      );

      const updatedNodes = applyNodeChanges(changes, state.nodes);

      // Skip synchronization during drag, run it when drag ends or for other changes
      if (isDragging) {
        return { nodes: updatedNodes };
      }

      return {
        nodes: applyDerivedNodeState(updatedNodes, state.edges),
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = sanitizeEdges(
        applyEdgeChanges(changes, state.edges),
      );
      const nextNodes = applyDerivedNodeState(state.nodes, nextEdges);

      return {
        edges: nextEdges,
        nodes: nextNodes,
      };
    }),
  toggleEvidenceAttribute: (characterId, attribute) =>
    set((state) => {
      const key = buildEvidenceAttributeKey(characterId, attribute);
      const current = state.selectedEvidenceAttributes ?? {};
      const next = { ...current };
      const isDeselecting = Boolean(next[key]);

      if (isDeselecting) {
        delete next[key];

        // When deselecting a trait, also deselect all snippets associated with this trait
        const normalizedAttribute = attribute.trim().toLowerCase();
        const nextSnippets = { ...state.selectedSnippets };
        let snippetsChanged = false;

        Object.keys(nextSnippets).forEach((snippetKey) => {
          const snippet = nextSnippets[snippetKey];
          if (
            snippet.characterId === characterId &&
            snippet.attributes.some(
              (attr) => attr.trim().toLowerCase() === normalizedAttribute,
            )
          ) {
            delete nextSnippets[snippetKey];
            snippetsChanged = true;
          }
        });

        if (snippetsChanged) {
          return {
            selectedEvidenceAttributes: next,
            selectedSnippets: nextSnippets,
          };
        }

        return { selectedEvidenceAttributes: next };
      } else {
        next[key] = true;
        return { selectedEvidenceAttributes: next };
      }
    }),
  clearEvidenceAttribute: (characterId, attribute) =>
    set((state) => {
      const key = buildEvidenceAttributeKey(characterId, attribute);
      if (!state.selectedEvidenceAttributes?.[key]) {
        return {};
      }
      const next = { ...state.selectedEvidenceAttributes };
      delete next[key];
      return { selectedEvidenceAttributes: next };
    }),
  clearAllEvidenceAttributes: () => set({ selectedEvidenceAttributes: {} }),
  toggleSnippet: (snippet) =>
    set((state) => {
      const key = buildSnippetKey(snippet.perspectiveNodeId, snippet.text);
      const current = state.selectedSnippets ?? {};
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = snippet;
      }
      return { selectedSnippets: next };
    }),
  clearSnippet: (perspectiveNodeId, snippetText) =>
    set((state) => {
      const key = buildSnippetKey(perspectiveNodeId, snippetText);
      if (!state.selectedSnippets?.[key]) {
        return {};
      }
      const next = { ...state.selectedSnippets };
      delete next[key];
      return { selectedSnippets: next };
    }),
  clearAllSnippets: () => set({ selectedSnippets: {} }),
  setExtractedCharacters: (eventGroupId, characters) =>
    set((state) => ({
      extractedCharacters: {
        ...state.extractedCharacters,
        [eventGroupId]: characters,
      },
    })),
  getPerspectiveEvidenceTarget: (perspectiveId) => {
    const state = get();
    return prepareEvidenceAnalysisPayload(
      perspectiveId,
      state.nodes,
      state.edges,
    );
  },
  getPerspectiveEvidenceTargets: (perspectiveIds) => {
    const state = get();
    return buildBatchEvidenceTargets(
      perspectiveIds,
      state.nodes,
      state.edges,
    );
  },
  preparePerspectiveGeneration: (targetNodeIds) => {
    const state = get();
    return preparePerspectiveGenerationPayload(
      state.nodes,
      state.edges,
      targetNodeIds,
    );
  },
  duplicateNarrativeGroup: (groupId) =>
    set((state) => {
      const result = duplicateNarrativeGroupCluster(
        groupId,
        state.nodes,
        state.edges,
      );

      if (!result) {
        return {};
      }

      const nextEdges = sanitizeEdges([...state.edges, ...result.newEdges]);
      const nextNodes = applyDerivedNodeState(
        [...state.nodes, ...result.newNodes],
        nextEdges,
      );

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    }),
  getNarrativeEventsData: (groupId) => {
    const state = get();
    return prepareNarrativeEventsData(groupId, state.nodes, state.edges);
  },
  reset: () => set(getInitialState()),
});

export const useWorkflowStore = ENABLE_PERSIST
  ? create<WorkflowState>()(
      persist(workflowStoreCreator, {
        name: "workflow-canvas-storage",
        version: STORAGE_VERSION,
        storage: createJSONStorage(() => createThrottledStorage()),
        migrate: (persistedState, version) => {
          if (!persistedState) {
            return getInitialState();
          }

          const state = persistedState as Partial<WorkflowState>;
          const shouldEnsureNames = version < STORAGE_VERSION;
          const edges = sanitizeEdges(state.edges ?? []);
          const nodesWithNames = shouldEnsureNames
            ? ensureNarrationGroupCharacterNames(state.nodes)
            : (state.nodes ?? []);
          const normalizedNodes = applyDerivedNodeState(nodesWithNames, edges);

          return {
            ...state,
            nodes: normalizedNodes,
            edges,
            selectedEvidenceAttributes: state.selectedEvidenceAttributes ?? {},
            selectedSnippets: state.selectedSnippets ?? {},
            extractedCharacters: state.extractedCharacters ?? {},
          };
        },
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          selectedEvidenceAttributes: state.selectedEvidenceAttributes,
          selectedSnippets: state.selectedSnippets,
          extractedCharacters: state.extractedCharacters,
        }),
      }),
    )
  : create<WorkflowState>()(workflowStoreCreator);
