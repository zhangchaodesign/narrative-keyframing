"use client";

import { createContext } from "react";

type RunPerspectivesHandler = (targetNodeIds?: string[]) => void;

export const RunPerspectiveContext = createContext<RunPerspectivesHandler>(
  () => {},
);
