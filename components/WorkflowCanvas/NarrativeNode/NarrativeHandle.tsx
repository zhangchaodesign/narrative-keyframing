import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const NarrativeHandle: React.FC<HandleProps> = ({
  style,
  ...props
}) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "#9333EA",
        ...style,
      }}
      {...props}
    />
  );
};
