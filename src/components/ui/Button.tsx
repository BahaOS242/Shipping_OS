import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "gold" | "ghost" | "whatsapp" | "danger";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sea-600 text-white hover:bg-sea-700 shadow-[0_6px_16px_-6px_rgb(10_127_139/0.6)]",
  secondary: "bg-white text-ink ring-2 ring-inset ring-sand-200 hover:ring-sea-400 hover:bg-sea-50",
  gold: "bg-sun-400 text-ink hover:bg-sun-300 shadow-[0_6px_16px_-6px_rgb(240_180_0/0.7)]",
  ghost: "text-sea-700 hover:bg-sea-50",
  whatsapp: "bg-wa-green text-[#06331b] hover:brightness-95",
  danger: "bg-coral-500 text-white hover:bg-coral-700",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-base rounded-xl gap-2",
  lg: "min-h-14 px-6 text-lg rounded-2xl gap-2.5",
  xl: "min-h-16 px-8 text-xl rounded-2xl gap-3",
};

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; full?: boolean; className?: string; children: ReactNode };

export function buttonClass({ variant = "primary", size = "lg", full, className = "" }: Omit<Common, "children" | "icon">) {
  return `inline-flex items-center justify-center font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${full ? "w-full" : ""} ${className}`;
}

export function Button({ variant, size, icon, full, className, children, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={buttonClass({ variant, size, full, className })} {...rest}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, full, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass({ variant, size, full, className })} {...rest}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </Link>
  );
}
