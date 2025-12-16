import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const CustomHandle: React.FC<HandleProps> = ({ style, ...props }) => {
  return (
    <Handle
      style={{
        width: 12,
        height: 12,
        background: "gray",
        transition: "transform 0.2s ease, width 0.2s ease, height 0.2s ease",
        ...style,
      }}
      className="hover:w-8! hover:h-8!"
      {...props}
    />
  );
};
