"use client";

import { useCallback } from "react";
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
import { CustomEdge } from "@/components/WorkflowCanvas/CustomEdge";
import { EventEdge } from "@/components/WorkflowCanvas/EventNode/EventEdge";
import { CharacterNode } from "@/components/WorkflowCanvas/CharacterNode/CharacterNode";
import { EventNode } from "@/components/WorkflowCanvas/EventNode/EventNode";
import { PerspectiveNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveNode";
import { NarrativeNode } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeNode";
import { EventGroupNode } from "@/components/WorkflowCanvas/EventNode/EventGroupNode";
import { PerspectiveGroupNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveGroupNode";
import { NarrativeGroupNode } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeGroupNode";
import { WorkflowCanvasMenu } from "@/components/WorkflowCanvas/WorkflowCanvasMenu";
import {
  createStoryOutlineCluster,
  adjustEventCountForAllClusters,
  nodeColor,
} from "@/lib/utiils/workflowUtils";

const nodeTypes: NodeTypes = {
  event: EventNode,
  perspective: PerspectiveNode,
  narrative: NarrativeNode,
  character: CharacterNode,
  eventGroup: EventGroupNode,
  perspectiveGroup: PerspectiveGroupNode,
  narrativeGroup: NarrativeGroupNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
  eventEdge: EventEdge,
};

export function WorkflowCanvas() {
  const proOptions = { hideAttribution: true };

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

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

  const handleAddStoryOutlineCluster = useCallback(
    (eventCount: number) => {
      const result = createStoryOutlineCluster(nodes, { eventCount });

      setNodes((currentNodes) => [...currentNodes, ...result.nodes]);
      setEdges((currentEdges) => [...currentEdges, ...result.edges]);
    },
    [nodes, setNodes, setEdges],
  );

  const handleEventCountChange = useCallback(
    (newEventCount: number) => {
      // Get current state directly from the store to avoid stale closures
      const currentNodes = useWorkflowStore.getState().nodes;
      const currentEdges = useWorkflowStore.getState().edges;

      const result = adjustEventCountForAllClusters(
        currentNodes,
        currentEdges,
        newEventCount,
      );

      setNodes(result.nodes);
      setEdges(result.edges);
    },
    [setNodes, setEdges],
  );

  return (
    <div className="h-full min-h-0 w-full relative">
      <WorkflowCanvasMenu
        onAddStoryOutlineCluster={handleAddStoryOutlineCluster}
        onEventCountChange={handleEventCountChange}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        // snapToGrid
        // snapGrid={[4, 4]}
        fitView
        minZoom={0.1}
        maxZoom={4}
      >
        <Background />
        <Controls position="bottom-left" />
        <MiniMap zoomable pannable nodeColor={nodeColor} />
      </ReactFlow>
    </div>
  );
}
