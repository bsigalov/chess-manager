import { cn } from "@/lib/utils";

interface TitleStyle {
  bg: string;
  text: string;
}

const TITLE_STYLES: Record<string, TitleStyle> = {
  GM:  { bg: "bg-amber-500/20",  text: "text-amber-700 dark:text-amber-400" },
  IM:  { bg: "bg-orange-500/20", text: "text-orange-700 dark:text-orange-400" },
  FM:  { bg: "bg-teal-500/20",   text: "text-teal-700 dark:text-teal-400" },
  CM:  { bg: "bg-sky-500/20",    text: "text-sky-700 dark:text-sky-400" },
  NM:  { bg: "bg-slate-500/20",  text: "text-slate-600 dark:text-slate-400" },
};

export function getTitleStyle(title: string | null | undefined): TitleStyle | null {
  if (!title) return null;
  const t = title.toUpperCase().trim();
  if (!t) return null;
  // WGM → GM, WIM → IM, etc.
  const base = t.startsWith("W") && t.length > 1 ? t.slice(1) : t;
  return TITLE_STYLES[base] ?? TITLE_STYLES["NM"];
}

export function TitleBadge({ title, className }: { title: string | null | undefined; className?: string }) {
  const style = getTitleStyle(title);
  if (!style) return null;
  return (
    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold leading-none", style.bg, style.text, className)}>
      {title}
    </span>
  );
}
