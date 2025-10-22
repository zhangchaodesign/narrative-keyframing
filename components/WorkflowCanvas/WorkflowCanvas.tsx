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
import { PaymentCountryNode } from "./PaymentCountryNode";
import { PaymentInitNode } from "./PaymentInitNode";
import { PaymentProviderNode } from "./PaymentProviderNode";
import {
  initialEdges,
  initialNodes,
  type WorkflowEdge,
  type WorkflowNode,
} from "./workflow.constants";

const nodeTypes: NodeTypes = {
  paymentInit: PaymentInitNode,
  paymentCountry: PaymentCountryNode,
  paymentProvider: PaymentProviderNode,
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
    <div className="h-full min-h-0 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        // fitView
      >
        <Background />
        <Controls position="top-left" />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
