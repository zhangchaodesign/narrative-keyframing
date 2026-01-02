import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { PERSPECTIVE_MESSAGES } from "@/lib/utiils/perspectiveUtils";

interface PerspectiveStatusLabelProps {
  isAnalyzingEvidence: boolean;
  analysisStatus: "idle" | "running" | "success" | "error";
  analysisStatusMessage?: string;
  hasReflectionContent: boolean;
  variant?: "div" | "span";
}

const READY_TO_ANALYZE_MESSAGE = "Ready to analyze evidence.";

export function PerspectiveStatusLabel({
  isAnalyzingEvidence,
  analysisStatus,
  analysisStatusMessage,
  hasReflectionContent,
  variant = "div",
}: PerspectiveStatusLabelProps) {
  let labelText: string;
  let labelClass = "text-gray-400";

  if (isAnalyzingEvidence) {
    labelText = PERSPECTIVE_MESSAGES.ANALYZING;
    labelClass = "text-blue-600";
  } else if (analysisStatus === "success") {
    labelText = analysisStatusMessage ?? READY_TO_ANALYZE_MESSAGE;
    labelClass = "text-green-600";
  } else if (analysisStatus === "error") {
    labelText = analysisStatusMessage ?? PERSPECTIVE_MESSAGES.FAILED;
    labelClass = "text-red-600";
  } else if (!hasReflectionContent) {
    labelText = PERSPECTIVE_MESSAGES.NEED_REFLECTION;
  } else if (analysisStatusMessage) {
    labelText = analysisStatusMessage;
    if (
      analysisStatusMessage === PERSPECTIVE_MESSAGES.NO_CHARACTERS ||
      analysisStatusMessage === PERSPECTIVE_MESSAGES.NO_EVIDENCE
    ) {
      labelClass = "text-amber-600";
    }
  } else {
    labelText = READY_TO_ANALYZE_MESSAGE;
  }

  const className = cn(
    geistMono.className,
    "text-[9px] font-medium tracking-wide",
    variant === "div" && "uppercase",
    labelClass,
  );

  if (variant === "span") {
    return <span className={className}>{labelText}</span>;
  }

  return <div className={className}>{labelText}</div>;
}
