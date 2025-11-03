"use client";

import dynamic from "next/dynamic";

export const DynamicTextEditor = dynamic(() => import("./TextEditor"), {
  ssr: false,
});
