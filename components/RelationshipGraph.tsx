"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Relationship } from "@/lib/stores/relationshipStore";
import { Character } from "@/lib/stores/characterStore";
import CustomNode from "./CustomNode";

interface RelationshipGraphProps {
  relationships: Relationship[];
  characters: Character[]; // All characters (manual + AI)
  onCharacterClick?: (characterName: string) => void;
}

// Auto-layout using dagre
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 75,
        y: nodeWithPosition.y - 40,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Define custom node types
const nodeTypes = { custom: CustomNode };

function AutoFitOnChange({ deps }: { deps: React.DependencyList }) {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    // wait for nodes/edges to be in the DOM
    requestAnimationFrame(() => {
      // if your nodes have images/dynamic size, a tiny timeout helps
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

export default function RelationshipGraph({
  relationships,
  characters,
  onCharacterClick,
}: RelationshipGraphProps) {
  const proOptions = { hideAttribution: true };

  // Build initial nodes/edges from props
  const { initialNodes, initialEdges } = React.useMemo(() => {
    const characterSet = new Set<string>(characters.map((c) => c.name));
    relationships.forEach((rel) => {
      characterSet.add(rel.source);
      characterSet.add(rel.target);
    });

    const nodes: Node[] = Array.from(characterSet).map((char) => ({
      id: char,
      type: "custom",
      data: { label: char },
      position: { x: 0, y: 0 },
    }));

    // dedupe and make STABLE ids
    const edgeMap = new Map<string, Relationship>();
    relationships.forEach((rel) => {
      const a = rel.source;
      const b = rel.target;
      const key = [a, b].sort().join("__"); // stable key
      if (!edgeMap.has(key)) edgeMap.set(key, rel);
    });

    const edges: Edge[] = Array.from(edgeMap.entries()).map(([key, rel]) => ({
      id: key, // <-- stable id
      source: rel.source,
      target: rel.target,
      label: rel.type,
      animated: true,
      style: { stroke: "#6b7280", strokeWidth: 2, strokeDasharray: "5, 5" },
      labelStyle: { fill: "#6b7280", fontWeight: 600, fontSize: "12px" },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
      data: { description: rel.description },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [relationships, characters]);

  // Lay out from dagre
  const { nodes: layoutedNodes, edges: layoutedEdges } = React.useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  // Keep state controlled & resync when layout/source changes
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(
    new Set(),
  );

  // When layout changes, push it into state while preserving selection flags
  React.useEffect(() => {
    setNodes((prev) =>
      layoutedNodes.map((n) => {
        const prevSelected =
          prev.find((p) => p.id === n.id)?.data?.isSelected ?? false;
        return { ...n, data: { ...n.data, isSelected: prevSelected } };
      }),
    );
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Keep selection in node data
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, isSelected: selectedNodeIds.has(node.id) },
      })),
    );
  }, [selectedNodeIds, setNodes]);

  const onNodeClick = React.useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
      onCharacterClick?.(node.id);
    },
    [onCharacterClick],
  );

  if (characters.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm px-4">
        No characters yet. Add characters manually or extract them from your
        story.
      </div>
    );
  }

  return (
    <div className="h-[250px] rounded">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnDrag
        selectionOnDrag={false}
        multiSelectionKeyCode={null}
      >
        <Controls />
        <AutoFitOnChange deps={[layoutedNodes, layoutedEdges]} />
      </ReactFlow>
    </div>
  );
}
