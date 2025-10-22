import React, { useCallback, useMemo, useState } from "react";
import { TbPlus, TbX } from "react-icons/tb";
import {
  BezierEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

import type { WorkflowEdge, WorkflowNode } from "./workflow.constants";

export const CustomEdge: React.FC<EdgeProps> = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    type,
    animated,
  } = props;

  const { setEdges, setNodes, getNode } =
    useReactFlow<WorkflowNode, WorkflowEdge>();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const canInsertNode = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    const isEventEdge =
      sourceNode.type === "event" && targetNode.type === "event";
    const isNarrationEdge =
      sourceNode.type === "narration" && targetNode.type === "narration";

    return isEventEdge || isNarrationEdge;
  }, [getNode, source, target]);

  const handleDeleteEdge = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== id));
      setIsHovered(false);
    },
    [id, setEdges],
  );

  const handleInsertNode = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      const sourceNode = getNode(source);
      const targetNode = getNode(target);

      if (!sourceNode || !targetNode) {
        return;
      }

      const isEventEdge =
        sourceNode.type === "event" && targetNode.type === "event";
      const isNarrationEdge =
        sourceNode.type === "narration" && targetNode.type === "narration";

      if (!isEventEdge && !isNarrationEdge) {
        return;
      }

      const midpoint = {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      };

      if (isEventEdge) {
        const timestamp = Date.now();
        const newNodeId = `event-${timestamp}`;

        setNodes((nodesState) => {
          const eventCount = nodesState.filter(
            (nodeState) => nodeState.type === "event",
          ).length;

          const newNode: WorkflowNode = {
            id: newNodeId,
            type: "event",
            position: {
              x: midpoint.x,
              y: sourceNode.position.y,
            },
            data: {
              timeline: `Event ${eventCount + 1}`,
              description: "",
            },
            draggable: false,
          };

          return [...nodesState, newNode];
        });

        setEdges((edgesState) => {
          const withoutCurrent = edgesState.filter((edge) => edge.id !== id);
          const baseEdgeId = `edge-${timestamp}`;

          const firstEdge: WorkflowEdge = {
            id: `${baseEdgeId}-a`,
            source,
            target: newNodeId,
            sourceHandle,
            targetHandle: "event-prev",
            type: type ?? "customEdge",
            animated,
          };

          const secondEdge: WorkflowEdge = {
            id: `${baseEdgeId}-b`,
            source: newNodeId,
            target,
            sourceHandle: "event-next",
            targetHandle,
            type: type ?? "customEdge",
            animated,
          };

          return [...withoutCurrent, firstEdge, secondEdge];
        });
      }

      if (isNarrationEdge) {
        const timestamp = Date.now();
        const newNodeId = `narration-${timestamp}`;

        setNodes((nodesState) => {
          const narrationCount = nodesState.filter(
            (nodeState) => nodeState.type === "narration",
          ).length;

          const newNode: WorkflowNode = {
            id: newNodeId,
            type: "narration",
            position: {
              x: midpoint.x,
              y: sourceNode.position.y,
            },
            data: {
              narrator: `Narrator ${narrationCount + 1}`,
              reflection: "Write the next reflection...",
            },
            draggable: false,
          };

          return [...nodesState, newNode];
        });

        setEdges((edgesState) => {
          const withoutCurrent = edgesState.filter((edge) => edge.id !== id);
          const baseEdgeId = `edge-${timestamp}`;

          const firstEdge: WorkflowEdge = {
            id: `${baseEdgeId}-a`,
            source,
            target: newNodeId,
            sourceHandle,
            targetHandle: "narration-prev",
            type: type ?? "customEdge",
            animated,
          };

          const secondEdge: WorkflowEdge = {
            id: `${baseEdgeId}-b`,
            source: newNodeId,
            target,
            sourceHandle: "narration-next",
            targetHandle,
            type: type ?? "customEdge",
            animated,
          };

          return [...withoutCurrent, firstEdge, secondEdge];
        });
      }

      setIsHovered(false);
    },
    [
      animated,
      getNode,
      id,
      setEdges,
      setNodes,
      source,
      sourceHandle,
      target,
      targetHandle,
      type,
    ],
  );

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BezierEdge {...props} />
        <EdgeLabelRenderer>
          {isHovered && (
            <div
              className="absolute flex items-center gap-1"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
              }}
            >
              {canInsertNode && (
                <button
                  type="button"
                  aria-label="Insert node"
                  className="btn btn-circle btn-xs bg-transparent shadow-none border-0 text-indigo-500 hover:bg-indigo-500 hover:text-white hover:border-white rounded-full"
                  onClick={handleInsertNode}
                >
                  <TbPlus />
                </button>
              )}
              <button
                type="button"
                aria-label="Delete edge"
                className="btn btn-circle btn-xs bg-transparent shadow-none border-0 text-red-500 hover:bg-red-500 hover:text-white hover:border-white rounded-full"
                onClick={handleDeleteEdge}
              >
                <TbX />
              </button>
            </div>
          )}
        </EdgeLabelRenderer>
      </g>
    </>
  );
};
