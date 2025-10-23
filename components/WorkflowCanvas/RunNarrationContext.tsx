"use client";

import { createContext } from "react";

type RunNarrationsHandler = (targetNodeIds?: string[]) => void;

export const RunNarrationContext = createContext<RunNarrationsHandler>(() => {});
