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
const nodeTypes = {
  custom: CustomNode,
};

export default function RelationshipGraph({
  relationships,
  characters,
  onCharacterClick,
}: RelationshipGraphProps) {
  const proOptions = { hideAttribution: true };

  // Convert relationships to nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    // Start with all character names (from characters prop)
    const characterSet = new Set<string>(characters.map((c) => c.name));

    // Also add characters from relationships (in case relationships reference characters not in the list)
    relationships.forEach((rel) => {
      characterSet.add(rel.source);
      characterSet.add(rel.target);
    });

    // Create nodes for each character
    const nodes: Node[] = Array.from(characterSet).map((char) => ({
      id: char,
      type: "custom",
      data: { label: char },
      position: { x: 0, y: 0 }, // Will be set by layout
    }));

    // Deduplicate bidirectional edges - keep only one edge per pair
    const edgeMap = new Map<string, Relationship>();

    relationships.forEach((rel) => {
      // Create a sorted key so A-B and B-A map to same key
      const key = [rel.source, rel.target].sort().join("-");

      // Keep the first relationship for this pair
      if (!edgeMap.has(key)) {
        edgeMap.set(key, rel);
      }
    });

    // Create edges from deduplicated relationships
    const edges: Edge[] = Array.from(edgeMap.values()).map((rel, idx) => {
      return {
        id: `${rel.source}-${rel.target}-${idx}`,
        source: rel.source,
        target: rel.target,
        label: rel.type,
        animated: true, // Animated flow
        style: {
          stroke: "#6b7280", // Gray color
          strokeWidth: 2,
          strokeDasharray: "5, 5", // Dashed line
        },
        labelStyle: {
          fill: "#6b7280", // Gray color
          fontWeight: 600,
          fontSize: "12px",
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.9,
        },
        data: { description: rel.description },
      };
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [relationships, characters]);

  // Apply auto-layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );

  // Update node data to include custom selected state
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSelected: selectedNodeIds.has(node.id),
        },
      })),
    );
  }, [selectedNodeIds, setNodes]);

  // Handle node click - toggle selection and highlight character in editor
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        return newSet;
      });

      if (onCharacterClick) {
        onCharacterClick(node.id);
      }
    },
    [onCharacterClick],
  );

  if (characters.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm px-4">
        No characters yet. Add characters manually or extract them from your story.
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
        panOnDrag={true}
        selectionOnDrag={false}
        multiSelectionKeyCode={null}
      >
        <Controls />
        {/* <MiniMap /> */}
        {/* <Background /> */}
      </ReactFlow>
    </div>
  );
}
