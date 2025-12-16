import { useState, useEffect, useRef } from "react";
import { TbPlus, TbChevronDown } from "react-icons/tb";

interface WorkflowCanvasMenuProps {
  onAddStoryOutlineCluster: (eventCount: number) => void;
  onEventCountChange: (newCount: number) => void;
}

export function WorkflowCanvasMenu({
  onAddStoryOutlineCluster,
  onEventCountChange,
}: WorkflowCanvasMenuProps) {
  const [eventCount, setEventCount] = useState(4);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the initial mount to avoid triggering adjustment on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onEventCountChange(eventCount);
  }, [eventCount]);

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
      <div className="form-control">
        <label className="label py-0 px-1 mr-1">
          <span className="label-text text-xs">Events</span>
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={eventCount}
          onChange={(e) => setEventCount(Number(e.target.value))}
          className="input input-sm input-bordered w-16 rounded"
        />
      </div>
    </div>
  );
}
