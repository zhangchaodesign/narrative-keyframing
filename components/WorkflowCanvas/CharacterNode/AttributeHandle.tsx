import React from "react";
import { Handle, Position, type HandleProps } from "@xyflow/react";

export const AttributeHandle: React.FC<HandleProps> = ({
  style,
  onMouseEnter,
  onMouseLeave,
  position,
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const { transform: incomingTransform, ...restStyle } = style ?? {};

  const baseTransform =
    typeof incomingTransform === "string" && incomingTransform.length > 0
      ? incomingTransform
      : position === Position.Right
      ? "translate(50%, -50%)"
      : position === Position.Bottom
      ? "translate(-50%, 50%)"
      : "translate(-50%, -50%)";

  const combinedTransform = `${baseTransform} scale(${isHovered ? 1.4 : 1})`;

  const handleMouseEnter = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      onMouseEnter?.(event);
    },
    [onMouseEnter],
  );

  const handleMouseLeave = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      onMouseLeave?.(event);
    },
    [onMouseLeave],
  );

  return (
    <Handle
      position={position}
      style={{
        width: 10,
        height: 10,
        background: "#fcd34d",
        transition: "transform 150ms ease",
        ...restStyle,
        transform: combinedTransform,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    />
  );
};
