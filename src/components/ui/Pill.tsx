import { TONE_CLASS, type Tone } from "@/domain/copy";

/** Status label: always icon + words. Color only reinforces. */
export function Pill({ tone = "neutral", icon, children, size = "sm", className = "" }: { tone?: Tone; icon?: string; children: React.ReactNode; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const sz = { xs: "px-2 py-0.5 text-[11px]", sm: "px-2.5 py-0.5 text-xs", md: "px-3 py-1 text-sm", lg: "px-4 py-1.5 text-base" }[size];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-bold ring-1 ${TONE_CLASS[tone]} ${sz} ${className}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
