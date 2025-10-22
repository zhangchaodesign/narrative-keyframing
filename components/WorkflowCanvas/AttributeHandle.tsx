import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const AttributeHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "#fcd34d",
        ...style,
      }}
      {...props}
    />
  );
};
