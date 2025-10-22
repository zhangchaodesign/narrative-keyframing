import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const NarrationHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "#6366f1",
        ...style,
      }}
      {...props}
    />
  );
};
