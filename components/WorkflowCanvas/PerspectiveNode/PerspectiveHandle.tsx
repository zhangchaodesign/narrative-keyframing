import React from "react";
import { Handle, type HandleProps } from "@xyflow/react";

export const PerspectiveHandle: React.FC<HandleProps> = ({
  style,
  ...props
}) => {
  return (
    <Handle
      style={{
        width: 10,
        height: 10,
        background: "lightgray",
        transition: "transform 0.2s ease, width 0.2s ease, height 0.2s ease",
        ...style,
      }}
      className="hover:w-4! hover:h-4!"
      {...props}
    />
  );
};
