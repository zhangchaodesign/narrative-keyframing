import React, { useCallback, useMemo, useState } from "react";
import { TbX } from "react-icons/tb";
import {
  BezierEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export const CustomEdge: React.FC<EdgeProps<WorkflowEdge>> = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    type,
    animated,
  } = props;

  const { setEdges, setNodes, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isEventEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return sourceNode.type === "event" && targetNode.type === "event";
  }, [getNode, source, target]);

  const isEventPerspectiveEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return (
      (sourceNode.type === "event" && targetNode.type === "perspective") ||
      (sourceNode.type === "perspective" && targetNode.type === "event")
    );
  }, [getNode, source, target]);

  const isPerspectiveEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return (
      sourceNode.type === "perspective" && targetNode.type === "perspective"
    );
  }, [getNode, source, target]);

  const handleDeleteEdge = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== id));
      setIsHovered(false);
    },
    [id, setEdges],
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
                zIndex: 2000,
              }}
            >
              {!isEventEdge &&
                !isEventPerspectiveEdge &&
                !isPerspectiveEdge && (
                  <button
                    type="button"
                    aria-label="Delete edge"
                    className="btn btn-circle btn-xs bg-transparent shadow-none border-0 text-red-500 hover:bg-red-500 hover:text-white hover:border-white rounded-full"
                    onClick={handleDeleteEdge}
                  >
                    <TbX />
                  </button>
                )}
            </div>
          )}
        </EdgeLabelRenderer>
      </g>
    </>
  );
};
