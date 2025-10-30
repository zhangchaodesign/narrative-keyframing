import type {
  CharacterNodeType,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { sortEventsByTimeline } from "@/lib/utils/workflowUtils";

export type CharacterSnapshotPayload = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export type PerspectiveTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots: CharacterSnapshotPayload[];
};

export type GeneratePerspectiveResponse = {
  perspectives: Array<{
    reflection: string;
  }>;
};

export type PerspectivePreparationResult = {
  eventSequence: Array<{
    label: string;
    description: string;
  }>;
  tasks: PerspectiveTaskPayload[];
};

type PositionedCharacterSnapshot = CharacterSnapshotPayload & {
  positionX: number;
};

export const preparePerspectiveRequest = ({
  nodes,
  targetNodeIds,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  targetNodeIds?: string[];
}): PerspectivePreparationResult | null => {
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

  const eventNodeMap = new Map(
    sortedEventNodes.map((eventNode) => [eventNode.id, eventNode]),
  );
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

  const findEventForPerspective = (
    perspectiveNode: PerspectiveNodeType,
  ): EventNodeType | null => {
    const eventId = perspectiveNode.data?.eventId?.trim();
    const explicitEvent = eventNodeMap.get(eventId);
    return explicitEvent ?? null;
  };

  const relevantPerspectiveNodes = targetIdSet
    ? perspectiveNodes.filter((node) => targetIdSet.has(node.id))
    : perspectiveNodes;

  const tasksWithOrdering = relevantPerspectiveNodes
    .map((perspectiveNode) => {
      const eventNode = findEventForPerspective(perspectiveNode);
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

      let characterSnapshots = characterNodes
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
        })
        // .sort((a, b) => a.positionX - b.positionX)
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
