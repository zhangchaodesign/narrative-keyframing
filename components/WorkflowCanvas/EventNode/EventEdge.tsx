"use client";

import React, { useCallback, useMemo, useState } from "react";
import { TbPlus } from "react-icons/tb";
import {
  BezierEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import { useEventAdjacency } from "@/components/WorkflowCanvas/EventNode/useEventAdjacency";

export const EventEdge: React.FC<EdgeProps<WorkflowEdge>> = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props;

  const { getNode } = useReactFlow<WorkflowNode, WorkflowEdge>();

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

  // Use the adjacency hook for the source node to add event after it
  const { handleAddAdjacentEvent } = useEventAdjacency(source);

  const handleAddEventBetween = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      // Add an event "after" the source node, which will place it between source and target
      handleAddAdjacentEvent("after");

      setIsHovered(false);
    },
    [handleAddAdjacentEvent],
  );

  if (!isEventEdge) {
    return <BezierEdge {...props} />;
  }

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BezierEdge {...props} />
        {/* <EdgeLabelRenderer>
          {isHovered && (
            <div
              className="absolute flex items-center gap-1"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
                zIndex: 2000,
              }}
            >
              <button
                type="button"
                aria-label="Add event between"
                className="btn btn-circle btn-xs bg-pink-500 text-white hover:bg-pink-600 border-0 rounded-full shadow-md"
                onClick={handleAddEventBetween}
              >
                <TbPlus />
              </button>
            </div>
          )}
        </EdgeLabelRenderer> */}
      </g>
    </>
  );
};
