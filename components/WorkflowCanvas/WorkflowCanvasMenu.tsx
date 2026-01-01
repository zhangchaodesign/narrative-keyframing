import { TbPlus, TbChevronDown } from "react-icons/tb";

interface WorkflowCanvasMenuProps {
  eventCount: number;
  onAddStoryOutlineCluster: (eventCount: number) => void;
}

export function WorkflowCanvasMenu({
  eventCount,
  onAddStoryOutlineCluster,
}: WorkflowCanvasMenuProps) {
  const handleAddCluster = () => {
    onAddStoryOutlineCluster(eventCount);
  };

  return (
    <div className="absolute left-2 top-4 z-20 bg-white/90 p-2 rounded flex items-center gap-2">
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
              <button type="button" onClick={handleAddCluster}>
                <TbPlus size={16} className="text-pink-500" />
                <span>Story Outline Cluster</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
