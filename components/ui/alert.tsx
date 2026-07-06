import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-zinc-300",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
