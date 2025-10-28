import type {
  CharacterNodeType,
  EventNodeType,
  NarrationNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

export type CharacterSnapshotPayload = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export type NarrationTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots: CharacterSnapshotPayload[];
};

export type GenerateNarrationResponse = {
  narrations: Array<{
    reflection: string;
  }>;
};

export type NarrationPreparationResult = {
  eventSequence: Array<{
    label: string;
    description: string;
  }>;
  tasks: NarrationTaskPayload[];
};

export const parseEventTimelineIndex = (timeline?: string | null) => {
  if (!timeline) {
    return null;
  }

  const match = timeline.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? "", 10);
};

type PositionedCharacterSnapshot = CharacterSnapshotPayload & {
  positionX: number;
};

export const prepareNarrationRequest = ({
  nodes,
  edges,
  targetNodeIds,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  targetNodeIds?: string[];
}): NarrationPreparationResult | null => {
  const eventNodes = nodes.filter(
    (node): node is EventNodeType => node.type === "event",
  );
  const narrationNodes = nodes.filter(
    (node): node is NarrationNodeType => node.type === "narration",
  );

  const sortedEventNodes = [...eventNodes].sort((nodeA, nodeB) => {
    const indexA = parseEventTimelineIndex(nodeA.data?.timeline);
    const indexB = parseEventTimelineIndex(nodeB.data?.timeline);

    if (indexA != null && indexB != null && indexA !== indexB) {
      return indexA - indexB;
    }

    if (indexA != null) return -1;
    if (indexB != null) return 1;

    return nodeA.position.x - nodeB.position.x;
  });

  const eventOrderMap = new Map(
    sortedEventNodes.map((eventNode, indexPosition) => [
      eventNode.id,
      indexPosition,
    ]),
  );

  const eventSequence = sortedEventNodes.map((eventNode) => {
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

  const targetIdSet =
    targetNodeIds && targetNodeIds.length > 0 ? new Set(targetNodeIds) : null;

  const relevantNarrationNodes = targetIdSet
    ? narrationNodes.filter((node) => targetIdSet.has(node.id))
    : narrationNodes;

  const tasksWithOrdering = relevantNarrationNodes
    .map((narrationNode) => {
      const eventEdge = edges.find(
        (edge) =>
          edge.target === narrationNode.id && edge.targetHandle === "event",
      );
      if (!eventEdge) {
        return null;
      }

      const eventNode = nodes.find(
        (node): node is EventNodeType =>
          node.id === eventEdge.source && node.type === "event",
      );
      if (!eventNode) {
        return null;
      }

      const eventOrder =
        eventOrderMap.get(eventNode.id) ?? Number.MAX_SAFE_INTEGER;

      const characterEdges = edges.filter((edge) => {
        if (edge.target === narrationNode.id) {
          return edge.targetHandle === "character";
        }
        if (edge.source === narrationNode.id) {
          return edge.sourceHandle === "character";
        }
        return false;
      });

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
        narrationNode.data?.narrator?.trim() || "Narrator";

      let characterSnapshots = characterEdges
        .map((characterEdge) => {
          const connectedId =
            characterEdge.source === narrationNode.id
              ? characterEdge.target
              : characterEdge.source;
          const characterNode = nodes.find(
            (node): node is CharacterNodeType =>
              node.id === connectedId && node.type === "character",
          );

          if (!characterNode) {
            return null;
          }

          const name = characterNode.data?.name?.trim() || characterNode.id;
          const traits = characterNode.data?.traits ?? {
            physiology: [],
            psychology: [],
            sociology: [],
          };

          return {
            id: characterNode.id,
            name,
            positionX: characterNode.position.x,
            traits: {
              physiology: traits.physiology ?? [],
              psychology: traits.psychology ?? [],
              sociology: traits.sociology ?? [],
            },
          };
        })
        .filter(
          (
            snapshot,
          ): snapshot is PositionedCharacterSnapshot & { id: string } =>
            snapshot != null,
        )
        .reduce<
          Array<
            PositionedCharacterSnapshot & {
              id: string;
            }
          >
        >((accumulator, snapshot) => {
          if (accumulator.some((item) => item.id === snapshot.id)) {
            return accumulator;
          }
          accumulator.push(snapshot);
          return accumulator;
        }, [])
        .sort((a, b) => a.positionX - b.positionX)
        .map((snapshot) => {
          const { positionX: _ignore, id: _omitId, ...rest } = snapshot;
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

      const payload: NarrationTaskPayload = {
        id: narrationNode.id,
        narrator: narratorName,
        eventLabel,
        eventObjective,
        characterSnapshots,
      };

      return {
        order: eventOrder,
        secondaryOrder: narrationNode.position.x,
        task: payload,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        order: number;
        secondaryOrder: number;
        task: NarrationTaskPayload;
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
