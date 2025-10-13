"use client";

import dynamic from "next/dynamic";

export const DynamicEditorPage = dynamic(
  () => import("./EditorPage").then((mod) => ({ default: mod.EditorPage })),
  { ssr: false },
);
