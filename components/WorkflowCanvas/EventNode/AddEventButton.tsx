import { TbPlus } from "react-icons/tb";

type AddEventDirection = "before" | "after";

type AddEventButtonProps = {
  direction: AddEventDirection;
  onAdd: (direction: AddEventDirection) => void;
};

export function AddEventButton({ direction, onAdd }: AddEventButtonProps) {
  const isBefore = direction === "before";
  const sideClass = isBefore ? "-left-80" : "-right-80";
  const positionLabel = isBefore ? "before" : "after";

  return (
    <button
      type="button"
      onClick={() => onAdd(direction)}
      className={`absolute ${sideClass} top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100`}
      title={`Add event ${positionLabel}`}
      aria-label={`Add event ${positionLabel}`}
    >
      <TbPlus size={24} />
      <span>Add Event</span>
    </button>
  );
}
