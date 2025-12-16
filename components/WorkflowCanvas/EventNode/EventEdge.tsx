"use client";

import React, { useMemo, useState } from "react";
import { BezierEdge, type EdgeProps, useReactFlow } from "@xyflow/react";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
export const EventEdge: React.FC<EdgeProps<WorkflowEdge>> = (props) => {
  const { source, target } = props;

  const { getNode } = useReactFlow<WorkflowNode, WorkflowEdge>();

  const isEventEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return sourceNode.type === "event" && targetNode.type === "event";
  }, [getNode, source, target]);

  if (!isEventEdge) {
    return <BezierEdge {...props} />;
  }

  return (
    <>
      <g>
        <BezierEdge {...props} />
      </g>
    </>
  );
};
