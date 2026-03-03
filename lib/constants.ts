export const CHARACTER_COLORS = [
  { label: "bg-blue-500", watermark: "text-blue-200/75", bg: "bg-blue-50/75" },
  { label: "bg-violet-500", watermark: "text-violet-200/75", bg: "bg-violet-50/75" },
  { label: "bg-amber-500", watermark: "text-amber-200/75", bg: "bg-amber-50/75" },
  { label: "bg-indigo-500", watermark: "text-indigo-200/75", bg: "bg-indigo-50/75" },
  { label: "bg-orange-500", watermark: "text-orange-200/75", bg: "bg-orange-50/75" },
  { label: "bg-cyan-500", watermark: "text-cyan-200/75", bg: "bg-cyan-50/75" },
  { label: "bg-slate-500", watermark: "text-slate-200/75", bg: "bg-slate-50/75" },
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
