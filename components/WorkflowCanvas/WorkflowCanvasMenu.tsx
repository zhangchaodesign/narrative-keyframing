import { TbPlus } from "react-icons/tb";

interface WorkflowCanvasMenuProps {
  onAddStoryOutlineCluster: () => void;
  onAddFirstPersonCluster: () => void;
  onAddThirdPersonCluster: () => void;
}

export function WorkflowCanvasMenu({
  onAddStoryOutlineCluster,
  onAddFirstPersonCluster,
  onAddThirdPersonCluster,
}: WorkflowCanvasMenuProps) {
  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 z-20">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-xs bg-pink-500 text-white"
          onClick={onAddStoryOutlineCluster}
        >
          <TbPlus size={16} />
          Story Outline Cluster
        </button>
        <button
          type="button"
          className="btn btn-xs bg-secondary text-white"
          onClick={onAddFirstPersonCluster}
        >
          <TbPlus size={16} />
          First-Person Limited Cluster
        </button>
        <button
          type="button"
          className="btn btn-xs bg-primary text-white"
          onClick={onAddThirdPersonCluster}
        >
          <TbPlus size={16} />
          Third-Person Omniscient Cluster
        </button>
      </div>
    </div>
  );
}
