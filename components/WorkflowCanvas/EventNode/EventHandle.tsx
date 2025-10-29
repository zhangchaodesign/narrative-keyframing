import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const EventHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "#67CC8A",
        ...style,
      }}
      {...props}
    />
  );
};
