"use client";

import { useCallback, useState } from "react";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { CustomEdge } from "./CustomEdge";
import { CharacterNode } from "./CharacterNode/CharacterNode";
import { EventNode } from "./EventNode/EventNode";
import { NarrationNode } from "./NarrationNode/NarrationNode";
import { RunNarrationContext } from "./RunNarrationContext";
import {
  type CharacterNodeType,
  type EventNodeType,
  type NarrationNodeType,
  type WorkflowNode,
  type CharacterTraits,
} from "./workflow.constants";

type TraitCategory = keyof CharacterTraits;

type CharacterSnapshotPayload = {
  name: string;
  stageLabel?: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

type PositionedCharacterSnapshot = CharacterSnapshotPayload & {
  positionX: number;
};

type TraitTransitionPayload = {
  fromCharacter: string;
  toCharacter: string;
  category: TraitCategory;
  fromTrait?: string;
  toTrait?: string;
};

type NarrationTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots?: CharacterSnapshotPayload[];
  traitTransitions?: TraitTransitionPayload[];
};

type GenerateNarrationResponse = {
  narrations: Array<{
    id: string;
    reflection: string;
  }>;
};

const nodeTypes: NodeTypes = {
  event: EventNode,
  narration: NarrationNode,
  character: CharacterNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

const parseEventTimelineIndex = (timeline?: string | null) => {
  if (!timeline) {
    return null;
  }

  const match = timeline.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? "", 10);
};

const TRAIT_HANDLE_PATTERN =
  /^(.*)-(physiology|psychology|sociology)-(\d+)-(left|right)$/;

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

export function WorkflowCanvas() {
  const proOptions = { hideAttribution: true };

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runStatus, setRunStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleAddCharacterNode = useCallback(() => {
    setNodes((currentNodes) => {
      const characterCount = currentNodes.filter(
        (node) => node.type === "character",
      ).length;
      const newId = `character-${Date.now()}`;
      const newNode: WorkflowNode = {
        id: newId,
        type: "character",
        position: {
          x: 120 + Math.random() * 200,
          y: 450 + characterCount * 140,
        },
        data: {
          name: `New Character ${characterCount + 1}`,
          traits: {
            physiology: [],
            psychology: [],
            sociology: [],
          },
        },
      };
      return [...currentNodes, newNode];
    });
  }, [setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prevEdges) =>
        addEdge(
          {
            ...connection,
            id: `edge-${prevEdges.length}-${Date.now()}`,
            animated: true,
            type: "customEdge",
          },
          prevEdges,
        ),
      );
    },
    [setEdges],
  );

  const handleGenerateNarrations = useCallback(
    async (targetNodeIds?: string[]) => {
      if (isGenerating) {
        return;
      }

      setRunStatus(null);
      setIsGenerating(true);
      let loadingNodeIds: Set<string> | null = null;

      try {
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
          const characterName =
            characterNode.data?.name?.trim() || characterNode.id;
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

          (Object.keys(traitsByCategory) as TraitCategory[]).forEach(
            (category) => {
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
            },
          );
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
          targetNodeIds && targetNodeIds.length > 0
            ? new Set(targetNodeIds)
            : null;

        const relevantNarrationNodes = targetIdSet
          ? narrationNodes.filter((node) => targetIdSet.has(node.id))
          : narrationNodes;

        const tasksWithOrdering = relevantNarrationNodes
          .map(
            (
              narrationNode,
            ): {
              order: number;
              secondaryOrder: number;
              task: NarrationTaskPayload;
            } | null => {
              const eventEdge = edges.find(
                (edge) =>
                  edge.target === narrationNode.id &&
                  edge.targetHandle === "event",
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

                  const name =
                    characterNode.data?.name?.trim() || characterNode.id;
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

                if (
                  !traitTransitionsForTask ||
                  traitTransitionsForTask.length === 0
                ) {
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

              const narratorName =
                characterSnapshots[0]?.name || fallbackNarratorName;

              const payload: NarrationTaskPayload = {
                id: narrationNode.id,
                narrator: narratorName,
                eventLabel,
                eventObjective,
              };

              if (characterSnapshots.length > 0) {
                payload.characterSnapshots = characterSnapshots;
              }

              if (
                traitTransitionsForTask &&
                traitTransitionsForTask.length > 0
              ) {
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
            },
          )
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
          setRunStatus({
            type: "error",
            message: "No narration nodes were eligible for generation.",
          });
          return;
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

        loadingNodeIds = new Set(tasks.map((task) => task.id));
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type !== "narration") {
              return node;
            }

            const existingData = node.data as NarrationNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                isLoading: loadingNodeIds?.has(node.id) ?? false,
              },
            };
          }),
        );

        const response = await fetch("/api/narration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventSequence,
            narrations: tasks,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const errorMessage =
            (errorBody && errorBody.error) ||
            `Failed to generate narrations (${response.status}).`;
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as GenerateNarrationResponse;
        const updates = new Map<string, string>(
          (data?.narrations ?? []).map((item) => [item.id, item.reflection]),
        );

        if (updates.size === 0) {
          setRunStatus({
            type: "error",
            message: "No narration updates were returned.",
          });
          return;
        }

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type === "narration" && updates.has(node.id)) {
              const reflection = updates.get(node.id) ?? "";
              const existingData = node.data as NarrationNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  reflection,
                },
              };
            }
            return node;
          }),
        );

        setRunStatus(null);
      } catch (error) {
        console.error("Error generating narrations:", error);
        setRunStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected error generating narrations.",
        });
      } finally {
        if (loadingNodeIds) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.type !== "narration") {
                return node;
              }
              if (!loadingNodeIds?.has(node.id)) {
                return node;
              }

              const existingData = node.data as NarrationNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  isLoading: false,
                },
              };
            }),
          );
        }
        setIsGenerating(false);
      }
    },
    [edges, isGenerating, nodes, setNodes],
  );

  return (
    <RunNarrationContext.Provider value={handleGenerateNarrations}>
      <div className="h-full min-h-0 w-full relative">
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAddCharacterNode}
            className="btn-neutral btn-xs btn"
          >
            Add Character
          </button>
          {runStatus && (
            <p className="text-[11px] text-red-500">{runStatus.message}</p>
          )}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={proOptions}
          snapToGrid
          snapGrid={[10, 10]}
          fitView
        >
          <Background />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </RunNarrationContext.Provider>
  );
}
