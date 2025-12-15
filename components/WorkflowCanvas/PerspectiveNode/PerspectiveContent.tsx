import { useStore } from "@xyflow/react";
import { PerspectiveContent as SharedPerspectiveContent } from "@/components/shared/PerspectiveContent";
import type { PerspectiveEvidenceItem, WorkflowNode } from "@/lib/types/workflow";

interface PerspectiveContentProps {
  perspectiveNodeId: string;
  reflection: string;
  analysisEvidence?: PerspectiveEvidenceItem[];
  isEditing?: boolean;
  onReflectionChange?: (newReflection: string) => void;
}

export function PerspectiveContent(props: PerspectiveContentProps) {
  // Get nodes from ReactFlow store
  const nodes = useStore((store) => store.nodes as WorkflowNode[]);

  return <SharedPerspectiveContent {...props} nodes={nodes} variant="node" />;
}
