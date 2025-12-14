import type {
  WorkflowNode,
  WorkflowEdge,
  EventNodeType,
  NarrationGroupNodeType,
  PerspectiveNodeType,
  EventGroupNodeType,
} from "@/lib/types/workflow";

export type AddPerspectiveGroupOptions = {
  characterName?: string;
  eventGroupId?: string;
};

export function createPerspectiveGroup(
  currentNodes: WorkflowNode[],
  currentEdges: WorkflowEdge[],
  options: AddPerspectiveGroupOptions = {},
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const { characterName = "", eventGroupId } = options;

  // Find event nodes to base the cluster on
  const eventNodes = currentNodes.filter((node): node is EventNodeType => {
    if (eventGroupId) {
      return node.type === "event" && node.parentId === eventGroupId;
    }
    return node.type === "event";
  });

  if (eventNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const sortedEvents = [...eventNodes].sort(
    (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
  );

  const perspectiveGroups = currentNodes.filter(
    (node): node is NarrationGroupNodeType =>
      node.type === "perspectiveGroup",
  );

  const eventGroup = eventGroupId
    ? currentNodes.find(
        (node): node is EventGroupNodeType =>
          node.id === eventGroupId && node.type === "eventGroup",
      )
    : currentNodes.find(
        (node): node is EventGroupNodeType => node.type === "eventGroup",
      );

  const DEFAULT_GROUP_STYLE = {
    width: 1200,
    height: 640,
    backgroundColor: "transparent",
    border: "none",
    padding: 0,
    boxShadow: "none",
  } as const;

  const baselineGroupStyle = perspectiveGroups[0]?.style ?? DEFAULT_GROUP_STYLE;
  const baselineWidth =
    typeof baselineGroupStyle?.width === "number"
      ? baselineGroupStyle.width
      : DEFAULT_GROUP_STYLE.width;
  const baselineHeight =
    typeof baselineGroupStyle?.height === "number"
      ? baselineGroupStyle.height
      : DEFAULT_GROUP_STYLE.height;
  const eventGroupWidth =
    typeof eventGroup?.style?.width === "number"
      ? eventGroup.style.width
      : baselineWidth;
  const clusterWidth = Math.max(baselineWidth, eventGroupWidth);

  const HORIZONTAL_GAP = 80;
  const VERTICAL_GAP = 80;

  // Calculate Y position: below event group or aligned with existing perspective groups
  const eventGroupHeight =
    typeof eventGroup?.style?.height === "number"
      ? eventGroup.style.height
      : 220; // Default event group height

  const baseGroupY =
    perspectiveGroups.length > 0
      ? perspectiveGroups[0]!.position.y
      : (eventGroup?.position.y ?? 20) + eventGroupHeight + VERTICAL_GAP;
  const rightmostEdge = perspectiveGroups.reduce((accumulator, group) => {
    const groupWidth =
      typeof group.style?.width === "number"
        ? group.style.width
        : baselineWidth;
    return Math.max(accumulator, group.position.x + groupWidth);
  }, Number.NEGATIVE_INFINITY);
  const newGroupX =
    perspectiveGroups.length === 0
      ? eventGroup?.position.x ?? 100
      : (rightmostEdge === Number.NEGATIVE_INFINITY
          ? perspectiveGroups[0]!.position.x + baselineWidth
          : rightmostEdge) + HORIZONTAL_GAP;
  const newGroupY = baseGroupY;

  const clusterSuffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const newGroupId = `perspective-group-${clusterSuffix}`;
  const perspectiveRowY =
    perspectiveGroups.length > 0
      ? currentNodes.find(
          (node): node is PerspectiveNodeType =>
            node.type === "perspective" &&
            node.parentId === perspectiveGroups[0]?.id,
        )?.position.y ?? 50
      : 50;

  const newPerspectiveNodes: WorkflowNode[] = sortedEvents.map(
    (eventNode, indexPosition) => ({
      id: `perspective-${clusterSuffix}-${indexPosition + 1}`,
      type: "perspective",
      position: {
        x: eventNode.position.x,
        y: perspectiveRowY,
      },
      data: {
        narrator: characterName,
        reflection: "",
        isLoading: false,
        eventId: eventNode.id,
      },
      draggable: false,
      parentId: newGroupId,
      extent: "parent",
    }),
  );

  const label = characterName
    ? `${characterName}'s Perspective`
    : "First-Person Limited Cluster";

  const newGroupNode: WorkflowNode = {
    id: newGroupId,
    type: "perspectiveGroup",
    position: {
      x: newGroupX,
      y: newGroupY,
    },
    data: {
      label,
      characterName,
    },
    style: {
      ...DEFAULT_GROUP_STYLE,
      ...(baselineGroupStyle ?? {}),
      width: clusterWidth,
      height: baselineHeight,
    },
  };

  // Create character nodes for first and last perspective nodes
  const firstPerspective = newPerspectiveNodes[0];
  const lastPerspective = newPerspectiveNodes[newPerspectiveNodes.length - 1];
  const characterNodes: WorkflowNode[] = [];
  const characterEdges: WorkflowEdge[] = [];

  if (firstPerspective) {
    const firstCharacterId = `character-${clusterSuffix}-1`;
    characterNodes.push({
      id: firstCharacterId,
      type: "character",
      position: {
        x: firstPerspective.position.x,
        y: 280,
      },
      draggable: false,
      data: {
        name: characterName || "",
        traits: {
          physiology: [],
          psychology: [],
          sociology: [],
        },
        perspectiveId: firstPerspective.id,
      },
      parentId: newGroupId,
      extent: "parent",
    });

    characterEdges.push({
      id: `edge-${firstCharacterId}-${firstPerspective.id}`,
      source: firstCharacterId,
      target: firstPerspective.id,
      sourceHandle: "perspective",
      targetHandle: "character",
      type: "customEdge",
      animated: true,
    });
  }

  if (lastPerspective && lastPerspective.id !== firstPerspective?.id) {
    const lastCharacterId = `character-${clusterSuffix}-${newPerspectiveNodes.length}`;
    characterNodes.push({
      id: lastCharacterId,
      type: "character",
      position: {
        x: lastPerspective.position.x,
        y: 280,
      },
      draggable: false,
      data: {
        name: characterName || "",
        traits: {
          physiology: [],
          psychology: [],
          sociology: [],
        },
        perspectiveId: lastPerspective.id,
      },
      parentId: newGroupId,
      extent: "parent",
    });

    characterEdges.push({
      id: `edge-${lastCharacterId}-${lastPerspective.id}`,
      source: lastCharacterId,
      target: lastPerspective.id,
      sourceHandle: "perspective",
      targetHandle: "character",
      type: "customEdge",
      animated: true,
    });
  }

  const newNodes = [newGroupNode, ...newPerspectiveNodes, ...characterNodes];

  const sequentialEdges = newPerspectiveNodes
    .slice(0, -1)
    .map((node, indexPosition) => ({
      id: `edge-${node.id}-${newPerspectiveNodes[indexPosition + 1]!.id}`,
      source: node.id,
      target: newPerspectiveNodes[indexPosition + 1]!.id,
      sourceHandle: "perspective-next",
      targetHandle: "perspective-prev",
      type: "customEdge",
      animated: true,
    }));

  const eventGroupIdForBridge = eventGroup?.id ?? eventGroupId ?? "event-group";
  const bridgingEdge = {
    id: `edge-${eventGroupIdForBridge}-${newGroupId}`,
    source: eventGroupIdForBridge,
    target: newGroupId,
    sourceHandle: "group-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  };

  const newEdges = [
    bridgingEdge,
    ...sequentialEdges,
    ...characterEdges,
  ];

  return { nodes: newNodes, edges: newEdges };
}
