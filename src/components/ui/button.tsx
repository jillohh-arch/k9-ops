import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-cyan-300 text-slate-950 font-bold hover:bg-cyan-200 shadow-[0_0_24px_rgba(77,208,225,0.24)]",
  secondary:
    "border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200 hover:bg-cyan-300/[0.12]",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
  danger:
    "border border-red-400/25 bg-red-400/10 text-red-200 hover:bg-red-400/[0.18]",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
