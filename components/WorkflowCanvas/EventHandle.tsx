import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const EventHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "oklch(55.2% 0.016 285.938)",
        ...style,
      }}
      {...props}
    />
  );
};
