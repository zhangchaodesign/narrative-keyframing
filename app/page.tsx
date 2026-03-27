"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { DynamicTextEditor } from "@/components/TextEditor/DynamicTextEditor";
import { WorkflowCanvas } from "@/components/WorkflowCanvas/WorkflowCanvas";
import { TimelineView } from "@/components/TrackView/TimelineView";
import { ViewSwitcher } from "@/components/ViewSwitcher/ViewSwitcher";
import { NarrativeTableView } from "@/components/TableView/NarrativeTableView";
import { TbHighlight } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { adjustEventCountForAllClusters } from "@/lib/utiils/workflowUtils";
import { buildTimelineData } from "@/lib/utiils/timelineUtils";
import { useUiStore } from "@/lib/stores/uiStore";
import { StudyEntryPanel, EndStudyButton } from "@/components/StudyManager";
import { useStudyStore } from "@/lib/stores/studyStore";
import { eventTracker } from "@/lib/utils";
import {
  exampleEventDescriptions,
  exampleCharacters,
} from "@/components/WorkflowCanvas/workflow.constants.3act";
import type {
  NarrativeCluster,
  StoryOutlineCluster,
} from "@/lib/types/timeline";
import type { ThirdPersonGroupNodeType } from "@/lib/types/workflow";

export default function Page() {
  const started = useStudyStore((state) => state.started);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const eventCount = useUiStore((state) => state.eventCount);
  const setEventCountStore = useUiStore((state) => state.setEventCount);
  const selectedStoryClusterId = useUiStore(
    (state) => state.selectedStoryClusterId,
  );
  const setSelectedStoryClusterId = useUiStore(
    (state) => state.setSelectedStoryClusterId,
  );
  const selectedNarrativeClusterId = useUiStore(
    (state) => state.selectedNarrativeClusterId,
  );
  const setSelectedNarrativeClusterId = useUiStore(
    (state) => state.setSelectedNarrativeClusterId,
  );
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(true);
  const isInitialMount = useRef(true);

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  // Timeline cluster data for dropdowns
  const { storyOutlineClusters, narrativeClusters } = useMemo(
    () => buildTimelineData(nodes, edges),
    [nodes, edges],
  );

  const filteredNarrativeClusters = useMemo(() => {
    if (!selectedStoryClusterId) return narrativeClusters;
    return narrativeClusters.filter(
      (cluster) => cluster.linkedEventGroupId === selectedStoryClusterId,
    );
  }, [narrativeClusters, selectedStoryClusterId]);

  // Auto-select first story cluster
  useEffect(() => {
    if (storyOutlineClusters.length > 0 && !selectedStoryClusterId) {
      setSelectedStoryClusterId(storyOutlineClusters[0].id);
    }
  }, [storyOutlineClusters, selectedStoryClusterId, setSelectedStoryClusterId]);

  // Auto-select first narrative cluster
  useEffect(() => {
    if (
      selectedNarrativeClusterId &&
      !filteredNarrativeClusters.find(
        (c) => c.id === selectedNarrativeClusterId,
      )
    ) {
      setSelectedNarrativeClusterId(
        filteredNarrativeClusters.length > 0
          ? filteredNarrativeClusters[0].id
          : null,
      );
    } else if (
      !selectedNarrativeClusterId &&
      filteredNarrativeClusters.length > 0
    ) {
      setSelectedNarrativeClusterId(filteredNarrativeClusters[0].id);
    }
  }, [
    filteredNarrativeClusters,
    selectedNarrativeClusterId,
    setSelectedNarrativeClusterId,
  ]);

  const formatStoryClusterLabel = (cluster: StoryOutlineCluster) => {
    if (typeof cluster.eventGroupNumber === "number") {
      return `${cluster.label} ${cluster.eventGroupNumber}`;
    }
    if (cluster.eventGroupId) {
      return `${cluster.label} (${cluster.eventGroupId})`;
    }
    return cluster.label;
  };

  const formatNarrativeClusterLabel = (cluster: NarrativeCluster) => {
    if (typeof cluster.narrativeGroupNumber === "number") {
      return `${cluster.label} ${cluster.narrativeGroupNumber}`;
    }
    if (cluster.narrativeGroupId) {
      return `${cluster.label} (${cluster.narrativeGroupId})`;
    }
    return cluster.label;
  };

  const handleStoryClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextClusterId = event.target.value;
    eventTracker({
      action: "change_timeline_story_dropdown",
      data: {
        from:
          storyOutlineClusters.find((c) => c.id === selectedStoryClusterId) ??
          null,
        to: storyOutlineClusters.find((c) => c.id === nextClusterId) ?? null,
        optionCount: storyOutlineClusters.length,
      },
    });
    setSelectedStoryClusterId(nextClusterId);
  };

  const handleNarrativeClusterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    const nextClusterId = value || null;
    const narrativeOptions = selectedStoryClusterId
      ? filteredNarrativeClusters
      : narrativeClusters;
    eventTracker({
      action: "change_timeline_narrative_dropdown",
      data: {
        from:
          narrativeOptions.find((c) => c.id === selectedNarrativeClusterId) ??
          null,
        to: narrativeOptions.find((c) => c.id === nextClusterId) ?? null,
        optionCount: narrativeOptions.length + 1,
      },
    });
    setSelectedNarrativeClusterId(nextClusterId);
  };

  // Narrative table controls
  const narrativeTableGroupId = useUiStore(
    (state) => state.narrativeTableGroupId,
  );
  const setNarrativeTableGroupId = useUiStore(
    (state) => state.setNarrativeTableGroupId,
  );
  const narrativeTableHighlight = useUiStore(
    (state) => state.narrativeTableHighlight,
  );
  const setNarrativeTableHighlight = useUiStore(
    (state) => state.setNarrativeTableHighlight,
  );

  const narrativeGroups = useMemo(
    () =>
      nodes.filter(
        (node): node is ThirdPersonGroupNodeType =>
          node.type === "narrativeGroup",
      ),
    [nodes],
  );

  const resolvedTableGroupId = useMemo(() => {
    if (
      narrativeTableGroupId &&
      narrativeGroups.some((group) => group.id === narrativeTableGroupId)
    ) {
      return narrativeTableGroupId;
    }
    const activeGroup = narrativeGroups.find(
      (group) => group.data?.isActiveInEditor,
    );
    return activeGroup?.id ?? narrativeGroups[0]?.id;
  }, [narrativeGroups, narrativeTableGroupId]);

  const formatTableNarrativeLabel = (group: ThirdPersonGroupNodeType) => {
    const label = group.data?.label?.trim() || "Narrative";
    if (typeof group.data?.narrativeGroupId === "number") {
      return `${label} ${group.data.narrativeGroupId}`;
    }
    return group.id ? `${label} (${group.id})` : label;
  };

  const handleTableGroupChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextGroupId = event.target.value || undefined;
    eventTracker({
      action: "change_narrative_table_group",
      data: {
        from:
          narrativeGroups.find((g) => g.id === resolvedTableGroupId) ?? null,
        to: narrativeGroups.find((g) => g.id === nextGroupId) ?? null,
        groupCount: narrativeGroups.length,
      },
    });
    setNarrativeTableGroupId(nextGroupId);
  };

  const handleToggleHighlight = () => {
    eventTracker({
      action: narrativeTableHighlight
        ? "disable_narrative_table_highlighting"
        : "enable_narrative_table_highlighting",
      data: { narrativeGroupId: resolvedTableGroupId ?? null },
    });
    setNarrativeTableHighlight(!narrativeTableHighlight);
  };

  const handleEventCountChange = (newCount: number) => {
    eventTracker({
      action: "change_event_count",
      data: { from: eventCount, to: newCount },
    });
    setEventCountStore(newCount);
  };

  const handleLoadExamples = () => {
    eventTracker({ action: "load_examples", data: null });

    // Set event count to match the example (5 plots)
    const targetEventCount = exampleEventDescriptions.length;
    if (eventCount !== targetEventCount) {
      handleEventCountChange(targetEventCount);
    }

    // Wait a tick for the event count adjustment to apply, then load data
    setTimeout(() => {
      const currentNodes = useWorkflowStore.getState().nodes;
      const currentEdges = useWorkflowStore.getState().edges;

      // Collect perspective groups to identify char1 vs char2
      const perspectiveGroups = currentNodes.filter(
        (n) => n.type === "perspectiveGroup",
      );
      const sortedGroups = [...perspectiveGroups].sort(
        (a, b) => a.position.x - b.position.x,
      );
      const char1GroupId = sortedGroups[0]?.id;
      const char2GroupId = sortedGroups[1]?.id;

      // Get sorted perspective nodes per group
      const getPerspectivesForGroup = (groupId: string | undefined) => {
        if (!groupId) return [];
        return currentNodes
          .filter((n) => n.type === "perspective" && n.parentId === groupId)
          .sort((a, b) => a.position.x - b.position.x);
      };

      const char1Perspectives = getPerspectivesForGroup(char1GroupId);
      const char2Perspectives = getPerspectivesForGroup(char2GroupId);

      // Build a map of perspectiveId -> existing character node
      const charByPerspective = new Map<
        string,
        (typeof currentNodes)[number]
      >();
      currentNodes.forEach((n) => {
        if (n.type === "character" && n.data?.perspectiveId) {
          charByPerspective.set(n.data.perspectiveId as string, n);
        }
      });

      // Track new nodes and edges to add
      const newNodes: typeof currentNodes = [];
      const newEdges: typeof currentEdges = [];
      const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Create character nodes for perspectives that don't have one
      const ensureCharacterNodes = (
        perspectives: typeof currentNodes,
        groupId: string | undefined,
        charSnapshots: typeof exampleCharacters.char1,
      ) => {
        if (!groupId) return;
        perspectives.forEach((pNode, actIndex) => {
          if (actIndex >= charSnapshots.length) return;
          if (charByPerspective.has(pNode.id)) return; // already has a character node

          const snapshot = charSnapshots[actIndex];
          const newCharId = `character-example-${timestamp}-${groupId}-${actIndex}`;
          newNodes.push({
            id: newCharId,
            type: "character",
            position: { x: pNode.position.x, y: 280 },
            draggable: false,
            data: {
              name: snapshot.name,
              traits: { ...snapshot.traits },
              perspectiveId: pNode.id,
            },
            parentId: groupId,
            extent: "parent",
          } as (typeof currentNodes)[number]);

          newEdges.push({
            id: `edge-${newCharId}-${pNode.id}`,
            source: newCharId,
            target: pNode.id,
            sourceHandle: "perspective",
            targetHandle: "character",
            type: "customEdge",
            animated: true,
          } as (typeof currentEdges)[number]);
        });
      };

      ensureCharacterNodes(
        char1Perspectives,
        char1GroupId,
        exampleCharacters.char1,
      );
      ensureCharacterNodes(
        char2Perspectives,
        char2GroupId,
        exampleCharacters.char2,
      );

      // Map existing character nodes to their plot index
      const getActIndex = (
        perspectiveId: string,
        perspectives: typeof currentNodes,
      ) => perspectives.findIndex((p) => p.id === perspectiveId);

      const updatedNodes = currentNodes.map((node) => {
        // Load event descriptions
        if (node.type === "event") {
          const eventNodes = currentNodes
            .filter((n) => n.type === "event" && n.parentId === node.parentId)
            .sort((a, b) => a.position.x - b.position.x);
          const index = eventNodes.findIndex((n) => n.id === node.id);
          if (index >= 0 && index < exampleEventDescriptions.length) {
            return {
              ...node,
              data: {
                ...node.data,
                description: exampleEventDescriptions[index],
              },
            };
          }
          return node;
        }

        // Load character data for existing character nodes
        if (node.type === "character") {
          const perspId = (node.data as { perspectiveId?: string })
            ?.perspectiveId;
          if (!perspId) return node;

          let charSnapshots: typeof exampleCharacters.char1 | undefined;
          let perspectives: typeof currentNodes = [];

          if (node.parentId === char1GroupId) {
            charSnapshots = exampleCharacters.char1;
            perspectives = char1Perspectives;
          } else if (node.parentId === char2GroupId) {
            charSnapshots = exampleCharacters.char2;
            perspectives = char2Perspectives;
          }
          if (!charSnapshots) return node;

          const actIndex = getActIndex(perspId, perspectives);
          if (actIndex < 0 || actIndex >= charSnapshots.length) return node;

          const snapshot = charSnapshots[actIndex];
          return {
            ...node,
            data: {
              ...node.data,
              name: snapshot.name,
              traits: { ...snapshot.traits },
            },
          };
        }

        // Update perspective group character names
        if (node.type === "perspectiveGroup") {
          if (node.id === char1GroupId) {
            return {
              ...node,
              data: {
                ...node.data,
                characterName: exampleCharacters.char1[0].name,
              },
            };
          }
          if (node.id === char2GroupId) {
            return {
              ...node,
              data: {
                ...node.data,
                characterName: exampleCharacters.char2[0].name,
              },
            };
          }
          return node;
        }

        // Update perspective narrator names
        if (node.type === "perspective") {
          if (node.parentId === char1GroupId) {
            return {
              ...node,
              data: {
                ...node.data,
                narrator: exampleCharacters.char1[0].name,
              },
            };
          }
          if (node.parentId === char2GroupId) {
            return {
              ...node,
              data: {
                ...node.data,
                narrator: exampleCharacters.char2[0].name,
              },
            };
          }
          return node;
        }

        return node;
      });

      const allNodes = [...updatedNodes, ...newNodes] as typeof currentNodes;
      const allEdges = [...currentEdges, ...newEdges] as typeof currentEdges;
      setNodes(allNodes);
      setEdges(allEdges);
    }, 100);
  };

  const handleEditorToggle = () => {
    eventTracker({
      action: isEditorCollapsed ? "click_chevron_right" : "click_chevron_left",
      data: {
        isEditorCollapsedBeforeClick: isEditorCollapsed,
      },
    });
    setIsEditorCollapsed((prev) => !prev);
  };

  useEffect(() => {
    // Skip the initial mount to avoid triggering adjustment on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Get current state directly from the store to avoid stale closures
    const currentNodes = useWorkflowStore.getState().nodes;
    const currentEdges = useWorkflowStore.getState().edges;

    const result = adjustEventCountForAllClusters(
      currentNodes,
      currentEdges,
      eventCount,
    );

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [eventCount, setNodes, setEdges]);

  if (!started) {
    return <StudyEntryPanel />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* <div className="shrink-0">
        <Header />
      </div> */}

      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <div className="flex h-full items-stretch overflow-hidden">
            <div
              className={clsx(
                "relative z-30 h-full transition-all duration-300 ease-in-out shrink-0",
                isEditorCollapsed ? "w-0" : "w-[600px]",
              )}
            >
              <div
                className={clsx(
                  "absolute inset-y-0 left-0 w-[600px] h-full transition-transform duration-300 ease-in-out",
                  isEditorCollapsed ? "-translate-x-full" : "translate-x-0",
                )}
              >
                <div className="h-full overflow-y-auto">
                  <DynamicTextEditor conflictHighlight={null} />
                </div>
              </div>

              <button
                type="button"
                onClick={handleEditorToggle}
                aria-label={
                  isEditorCollapsed ? "Show text editor" : "Hide text editor"
                }
                className="absolute top-1/2 left-full z-50 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-none rounded-r-full border border-gray-200 border-l-0 bg-white text-gray-600 hover:bg-gray-50"
              >
                {isEditorCollapsed ? (
                  <ChevronRight className="h-5 w-5 mr-1" />
                ) : (
                  <ChevronLeft className="h-5 w-5 mr-1" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0 overflow-hidden h-full flex flex-col">
              {/* View Switcher */}
              <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-2 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ViewSwitcher
                    currentView={viewMode}
                    onViewChange={setViewMode}
                  />
                  <div className="form-control">
                    <label className="label py-0 px-1 mr-1">
                      <span className="label-text text-xs">Plots</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={eventCount}
                      onChange={(e) =>
                        handleEventCountChange(Number(e.target.value))
                      }
                      className="input input-sm input-bordered w-16 rounded"
                    />
                  </div>
                  {/* <button
                    type="button"
                    onClick={handleLoadExamples}
                    className="btn btn-sm btn-soft"
                  >
                    Load Examples
                  </button> */}
                </div>
                <div className="flex items-center gap-3">
                  {viewMode === "timeline" &&
                    storyOutlineClusters.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="story-cluster-select"
                          className="text-xs text-gray-600 whitespace-nowrap"
                        >
                          Outline
                        </label>
                        <select
                          id="story-cluster-select"
                          value={selectedStoryClusterId || ""}
                          onChange={handleStoryClusterChange}
                          className="select select-sm select-bordered"
                        >
                          {storyOutlineClusters.map((cluster) => (
                            <option key={cluster.id} value={cluster.id}>
                              {formatStoryClusterLabel(cluster)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  {viewMode === "timeline" &&
                    filteredNarrativeClusters.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="narrative-cluster-select"
                          className="text-xs text-gray-600"
                        >
                          Narrative
                        </label>
                        <select
                          id="narrative-cluster-select"
                          value={selectedNarrativeClusterId || ""}
                          onChange={handleNarrativeClusterChange}
                          className="select select-sm select-bordered"
                        >
                          <option value="">None</option>
                          {filteredNarrativeClusters.map((cluster) => (
                            <option key={cluster.id} value={cluster.id}>
                              {formatNarrativeClusterLabel(cluster)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  {viewMode === "narrative-table" && (
                    <>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="table-narrative-group-select"
                          className="text-xs text-gray-600 whitespace-nowrap"
                        >
                          Narrative
                        </label>
                        <select
                          id="table-narrative-group-select"
                          value={resolvedTableGroupId ?? ""}
                          onChange={handleTableGroupChange}
                          className="select select-sm select-bordered"
                          disabled={narrativeGroups.length === 0}
                        >
                          {narrativeGroups.length === 0 ? (
                            <option value="">No groups</option>
                          ) : (
                            narrativeGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {formatTableNarrativeLabel(group)}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <button
                        onClick={handleToggleHighlight}
                        className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition ${
                          narrativeTableHighlight
                            ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        title={
                          narrativeTableHighlight
                            ? "Disable evidence highlighting"
                            : "Enable evidence highlighting"
                        }
                        aria-label={
                          narrativeTableHighlight
                            ? "Disable evidence highlighting"
                            : "Enable evidence highlighting"
                        }
                      >
                        <TbHighlight size={16} />
                        <span>
                          {narrativeTableHighlight
                            ? "Highlighting On"
                            : "Highlighting Off"}
                        </span>
                      </button>
                    </>
                  )}
                  <EndStudyButton />
                </div>
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-hidden">
                {viewMode === "workflow" ? (
                  <WorkflowCanvas eventCount={eventCount} />
                ) : viewMode === "timeline" ? (
                  <TimelineView />
                ) : (
                  <NarrativeTableView />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
