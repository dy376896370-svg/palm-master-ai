import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-white/[0.055] shadow-[0_24px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
