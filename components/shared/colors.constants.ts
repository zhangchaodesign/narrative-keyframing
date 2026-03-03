export const CHARACTER_COLORS = [
  {
    label: "bg-blue-500",
    watermark: "text-blue-200/75",
    bg: "bg-blue-50/75",
    border: "border-blue-400",
    text: "text-blue-600",
    highlight: "bg-blue-200",
  },
  {
    label: "bg-violet-500",
    watermark: "text-violet-200/75",
    bg: "bg-violet-50/75",
    border: "border-violet-400",
    text: "text-violet-600",
    highlight: "bg-violet-200",
  },
  {
    label: "bg-amber-500",
    watermark: "text-amber-200/75",
    bg: "bg-amber-50/75",
    border: "border-amber-400",
    text: "text-amber-600",
    highlight: "bg-amber-200",
  },
  {
    label: "bg-indigo-500",
    watermark: "text-indigo-200/75",
    bg: "bg-indigo-50/75",
    border: "border-indigo-400",
    text: "text-indigo-600",
    highlight: "bg-indigo-200",
  },
  {
    label: "bg-orange-500",
    watermark: "text-orange-200/75",
    bg: "bg-orange-50/75",
    border: "border-orange-400",
    text: "text-orange-600",
    highlight: "bg-orange-200",
  },
  {
    label: "bg-cyan-500",
    watermark: "text-cyan-200/75",
    bg: "bg-cyan-50/75",
    border: "border-cyan-400",
    text: "text-cyan-600",
    highlight: "bg-cyan-200",
  },
  {
    label: "bg-pink-500",
    watermark: "text-pink-200/75",
    bg: "bg-pink-50/75",
    border: "border-pink-400",
    text: "text-pink-600",
    highlight: "bg-pink-200",
  },
];

export function getCharacterColorIndex(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CHARACTER_COLORS.length;
}

export function getCharacterColors(key: string) {
  return CHARACTER_COLORS[getCharacterColorIndex(key)];
}
