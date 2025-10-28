import { TbPlus } from "react-icons/tb";

type AddCharacterButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function AddCharacterButton({
  onClick,
  disabled,
}: AddCharacterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="absolute left-1/2 top-full z-10 mt-10 flex h-48 w-64 -translate-x-1/2 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <TbPlus size={24} />
      <span>Add Character Snapshot</span>
    </button>
  );
}
