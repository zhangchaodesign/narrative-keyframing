import React, { useState } from "react";
import { TbX } from "react-icons/tb";
import {
  BezierEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

export const CustomEdge: React.FC<EdgeProps> = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props;

  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BezierEdge {...props} />
        <EdgeLabelRenderer>
          {isHovered && (
            <button
              aria-label="Delete Edge"
              className="btn btn-circle btn-xs absolute bg-transparent shadow-none border-0 text-red-500 hover:bg-red-500 hover:text-white hover:border-white rounded-full"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
              }}
              onClick={() =>
                setEdges((prevEdges) =>
                  prevEdges.filter((edge) => edge.id !== id),
                )
              }
            >
              <TbX />
            </button>
          )}
        </EdgeLabelRenderer>
      </g>
    </>
  );
};
