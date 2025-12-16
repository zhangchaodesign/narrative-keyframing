"use client";

import { type CSSProperties, type PropsWithChildren, useMemo } from "react";
import { useViewport } from "@xyflow/react";

import { cn } from "@/lib/utiils/sharedUtils";

type ZoomInvariantWrapperProps = PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
  transformOrigin?: CSSProperties["transformOrigin"];
  maxScale?: number;
}>;

export function ZoomInvariantWrapper({
  children,
  className,
  style,
  transformOrigin = "bottom right",
  maxScale = 3,
}: ZoomInvariantWrapperProps) {
  const { zoom } = useViewport();

  const zoomScale = zoom && Number.isFinite(zoom) && zoom !== 0 ? 1 / zoom : 1;
  const scale = Math.min(maxScale, zoomScale);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      ...style,
      transform: `scale(${scale})`,
      transformOrigin,
    }),
    [scale, style, transformOrigin],
  );

  return (
    <div className={cn(className)} style={mergedStyle}>
      {children}
    </div>
  );
}
