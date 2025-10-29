import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const CustomHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 12,
        height: 12,
        background: "gray",
        ...style,
      }}
      {...props}
    />
  );
};
