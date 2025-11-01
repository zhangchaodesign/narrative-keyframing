import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";

const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const READY_TO_ANALYZE_MESSAGE = "Ready to analyze evidence.";
const NEED_REFLECTION_MESSAGE = "Add a reflection to analyze evidence.";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

interface PerspectiveStatusLabelProps {
  isAnalyzingEvidence: boolean;
  analysisStatus: "idle" | "running" | "success" | "error";
  analysisStatusMessage?: string;
  hasReflectionContent: boolean;
}

export function PerspectiveStatusLabel({
  isAnalyzingEvidence,
  analysisStatus,
  analysisStatusMessage,
  hasReflectionContent,
}: PerspectiveStatusLabelProps) {
  let labelText: string;
  let labelClass = "text-zinc-400";

  if (isAnalyzingEvidence) {
    labelText = ANALYZING_EVIDENCE_MESSAGE;
    labelClass = "text-blue-600";
  } else if (analysisStatus === "success") {
    labelText = analysisStatusMessage ?? READY_TO_ANALYZE_MESSAGE;
    labelClass = "text-green-600";
  } else if (analysisStatus === "error") {
    labelText = analysisStatusMessage ?? ANALYSIS_FAILED_MESSAGE;
    labelClass = "text-red-600";
  } else if (!hasReflectionContent) {
    labelText = NEED_REFLECTION_MESSAGE;
  } else if (analysisStatusMessage) {
    labelText = analysisStatusMessage;
    if (
      analysisStatusMessage === NO_CHARACTERS_MESSAGE ||
      analysisStatusMessage === NO_EVIDENCE_FOUND_MESSAGE
    ) {
      labelClass = "text-amber-600";
    }
  } else {
    labelText = READY_TO_ANALYZE_MESSAGE;
  }

  return (
    <div
      className={cn(
        geistMono.className,
        "text-[9px] font-medium uppercase tracking-wide",
        labelClass,
      )}
    >
      {labelText}
    </div>
  );
}
