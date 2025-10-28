import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  NarrationNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

export type TraitCategory = keyof CharacterTraits;

export type CharacterSnapshotPayload = {
  name: string;
  stageLabel?: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export type TraitTransitionPayload = {
  fromCharacter: string;
  toCharacter: string;
  category: TraitCategory;
  fromTrait?: string;
  toTrait?: string;
};

export type NarrationTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots?: CharacterSnapshotPayload[];
  traitTransitions?: TraitTransitionPayload[];
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

const TRAIT_HANDLE_PATTERN =
  /^(.*)-(physiology|psychology|sociology)-(\d+)-(left|right)$/;

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

const parseTraitHandleId = (handleId?: string | null) => {
  if (!handleId) {
    return null;
  }

  const match = handleId.match(TRAIT_HANDLE_PATTERN);
  if (!match) {
    return null;
  }

  const [, nodeId, category, index] = match;
  return {
    nodeId,
    category: category as TraitCategory,
    index: Number.parseInt(index, 10),
  };
};

const getTraitValue = (
  node: CharacterNodeType,
  category: TraitCategory,
  index: number,
) => {
  const traits = node.data?.traits?.[category] ?? [];
  if (index < 0 || index >= traits.length) {
    return null;
  }
  return traits[index] ?? null;
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
  const characterNodes = nodes.filter(
    (node): node is CharacterNodeType => node.type === "character",
  );

  const characterNodeMap = new Map(
    characterNodes.map((node) => [node.id, node]),
  );

  const traitTransitionMap = new Map<string, TraitTransitionPayload>();
  const connectedSourceHandles = new Set<string>();

  edges.forEach((edge) => {
    const sourceDetails = parseTraitHandleId(edge.sourceHandle);
    const targetDetails = parseTraitHandleId(edge.targetHandle);
    if (edge.sourceHandle) {
      connectedSourceHandles.add(edge.sourceHandle);
    }
    if (!sourceDetails || !targetDetails) {
      return;
    }

    if (sourceDetails.category !== targetDetails.category) {
      return;
    }

    const sourceNode = characterNodeMap.get(edge.source);
    const targetNode = characterNodeMap.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    const fromCharacter = sourceNode.data?.name?.trim() || sourceNode.id;
    const toCharacter = targetNode.data?.name?.trim() || targetNode.id;
    const fromTrait = getTraitValue(
      sourceNode,
      sourceDetails.category,
      sourceDetails.index,
    );
    const toTrait = getTraitValue(
      targetNode,
      targetDetails.category,
      targetDetails.index,
    );

    const key = `${edge.sourceHandle ?? ""}->${edge.targetHandle ?? ""}`;
    if (traitTransitionMap.has(key)) {
      return;
    }

    traitTransitionMap.set(key, {
      fromCharacter,
      toCharacter,
      category: sourceDetails.category,
      fromTrait: fromTrait ?? undefined,
      toTrait: toTrait ?? undefined,
    });
  });

  characterNodes.forEach((characterNode) => {
    const characterName = characterNode.data?.name?.trim() || characterNode.id;
    const traitsByCategory = characterNode.data?.traits ?? {
      physiology: [],
      psychology: [],
      sociology: [],
    };

    const hasOutgoingAttributeEdge = edges.some((edge) => {
      if (edge.source !== characterNode.id) {
        return false;
      }
      return parseTraitHandleId(edge.sourceHandle) != null;
    });

    if (!hasOutgoingAttributeEdge) {
      return;
    }

    (Object.keys(traitsByCategory) as TraitCategory[]).forEach((category) => {
      const traitList = traitsByCategory[category] ?? [];
      traitList.forEach((traitValue, index) => {
        const rightHandleId = `${characterNode.id}-${category}-${index}-right`;
        if (!connectedSourceHandles.has(rightHandleId)) {
          const key = `disappear-${rightHandleId}`;
          if (!traitTransitionMap.has(key)) {
            traitTransitionMap.set(key, {
              fromCharacter: characterName,
              toCharacter: characterName,
              category,
              fromTrait: traitValue,
              toTrait: "(disappears)",
            });
          }
        }
      });
    });
  });

  const globalTraitTransitions = Array.from(traitTransitionMap.values());

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
        .map((snapshot, index) => {
          const { positionX: _ignore, id: _omitId, ...rest } = snapshot;
          return {
            ...rest,
            stageLabel: `Checkpoint ${index + 1}: ${snapshot.name}`,
          };
        });

      let traitTransitionsForTask: TraitTransitionPayload[] | undefined;

      if (characterSnapshots.length === 0) {
        traitTransitionsForTask = globalTraitTransitions;

        if (!traitTransitionsForTask || traitTransitionsForTask.length === 0) {
          characterSnapshots = [
            {
              name: fallbackNarratorName,
              stageLabel: `Narrator baseline for ${eventLabel}`,
              traits: {
                physiology: [],
                psychology: [],
                sociology: [],
              },
            },
          ];
        }
      }

      const narratorName = characterSnapshots[0]?.name || fallbackNarratorName;

      const payload: NarrationTaskPayload = {
        id: narrationNode.id,
        narrator: narratorName,
        eventLabel,
        eventObjective,
      };

      if (characterSnapshots.length > 0) {
        payload.characterSnapshots = characterSnapshots;
      }

      if (traitTransitionsForTask && traitTransitionsForTask.length > 0) {
        payload.traitTransitions = traitTransitionsForTask;
      }

      if (!payload.characterSnapshots && !payload.traitTransitions) {
        return null;
      }

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
