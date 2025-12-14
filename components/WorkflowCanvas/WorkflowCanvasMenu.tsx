import { TbPlus, TbChevronDown } from "react-icons/tb";

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
    <div className="absolute left-2 top-4 z-20 bg-white/90 p-1 rounded">
      <div className="dropdown">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-sm btn-ghost btn-neutral"
        >
          Add Cluster
          <TbChevronDown size={16} />
        </div>
        <div
          tabIndex={0}
          className="dropdown-content card card-sm bg-base-100 z-1 w-64 shadow-md"
        >
          <ul
            tabIndex={0}
            className="dropdown-content menu menu-sm bg-base-100 rounded-lg z-1 w-64 p-2 shadow-lg mt-2"
          >
            <li>
              <button type="button" onClick={onAddStoryOutlineCluster}>
                <TbPlus size={16} className="text-pink-500" />
                <span>Story Outline Cluster</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={onAddFirstPersonCluster}>
                <TbPlus size={16} className="text-secondary" />
                <span>First-Person Limited Cluster</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={onAddThirdPersonCluster}>
                <TbPlus size={16} className="text-primary" />
                <span>Third-Person Omniscient Cluster</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
