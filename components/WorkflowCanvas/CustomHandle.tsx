import React from "react";
import { Handle, HandleProps } from "@xyflow/react";

export const CustomHandle: React.FC<HandleProps> = (props) => {
  return (
    <Handle
      style={{
        width: 12,
        height: 12,
        background: "lightgray",
      }}
      {...props}
    />
  );
};
