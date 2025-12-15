import { TbPlus } from "react-icons/tb";
import { cn } from "@/lib/utiils/sharedUtils";

type AddCharacterButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  variant?: "default" | "timeline";
};

export function AddCharacterButton({
  onClick,
  disabled,
  isProcessing = false,
  variant = "default",
}: AddCharacterButtonProps) {
  const isDisabled = disabled || isProcessing;

  // When processing, force opacity to 100 to keep button visible
  const opacityClasses = isProcessing
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100";

  const baseClasses = `flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-[10px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-offset-2 ${opacityClasses}`;

  const variantClasses = {
    default:
      "absolute left-1/2 top-full z-10 mt-10 h-48 w-64 -translate-x-1/2 border-zinc-300 bg-zinc-100/70 text-zinc-400 focus-visible:outline-indigo-500",
    timeline:
      "absolute inset-0 border-zinc-300 bg-zinc-100/70 text-zinc-400 focus-visible:outline-indigo-500",
  };

  const iconSize = variant === "timeline" ? 20 : 24;
  const buttonText = isProcessing
    ? "Interpolating..."
    : variant === "timeline"
    ? "Add Snapshot"
    : "Add Character Snapshot";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(baseClasses, variantClasses[variant])}
      aria-live="polite"
    >
      <TbPlus
        size={iconSize}
        className={isProcessing ? "animate-spin" : undefined}
        aria-hidden="true"
      />
      <span className={variant === "timeline" ? "text-center px-2" : undefined}>
        {buttonText}
      </span>
    </button>
  );
}
