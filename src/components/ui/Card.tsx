import type { ComponentProps } from "react";

export function Card({ className = "", ...rest }: ComponentProps<"div">) {
  return <div className={`rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 ${className}`} {...rest} />;
}
