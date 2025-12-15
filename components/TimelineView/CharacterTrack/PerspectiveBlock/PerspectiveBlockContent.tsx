import { PerspectiveContent as SharedPerspectiveContent } from "@/components/shared/PerspectiveContent";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { PerspectiveEvidenceItem } from "@/lib/types/workflow";

interface PerspectiveBlockContentProps {
  perspectiveNodeId: string;
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
  isEditing?: boolean;
  onReflectionChange?: (newReflection: string) => void;
}

export function PerspectiveBlockContent(props: PerspectiveBlockContentProps) {
  // Get nodes from workflowStore (not ReactFlow)
  const nodes = useWorkflowStore((state) => state.nodes);

  return <SharedPerspectiveContent {...props} nodes={nodes} variant="block" />;
}
