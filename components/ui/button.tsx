import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  default:
    "border border-white/10 bg-white text-zinc-950 shadow-[0_20px_70px_rgba(255,255,255,0.12)] hover:bg-zinc-200",
  secondary:
    "border border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]",
  ghost:
    "border border-transparent bg-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
  outline:
    "border border-white/12 bg-black/20 text-zinc-200 hover:border-white/20 hover:bg-white/[0.06]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-6 text-base",
};

export function Button({
  children,
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] transition duration-200 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
