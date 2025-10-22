"use client";

import { useCallback } from "react";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CustomEdge } from "./CustomEdge";
import { CharacterNode } from "./CharacterNode";
import { EventNode } from "./EventNode";
import { NarrationNode } from "./NarrationNode";
import {
  initialEdges,
  initialNodes,
  type WorkflowEdge,
  type WorkflowNode,
} from "./workflow.constants";
import { random } from "nanoid";

const nodeTypes: NodeTypes = {
  event: EventNode,
  narration: NarrationNode,
  character: CharacterNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

export function WorkflowCanvas() {
  const proOptions = { hideAttribution: true };

  const [nodes, setNodes, onNodesChange] =
    useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<WorkflowEdge>(initialEdges);

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

  return (
    <div className="h-full min-h-0 w-full relative">
      <div className="absolute left-3 top-3 z-20">
        <button
          type="button"
          onClick={handleAddCharacterNode}
          className="btn-neutral btn-xs btn"
        >
          Add Character
        </button>
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
        fitView
      >
        <Background />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
