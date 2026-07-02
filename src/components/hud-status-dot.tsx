"use client";

import { cn } from "@/lib/utils";

export type HudStatusDotColor = "cyan" | "emerald" | "amber" | "red";

export interface HudStatusDotProps {
  /** Cor semântica do dot. */
  color: HudStatusDotColor;
  /** Tamanho em pixels (default 6). */
  size?: number;
  /** Habilita pulso de radar (default true). */
  pulse?: boolean;
  /** Classe adicional no wrapper. */
  className?: string;
}

const colorMap: Record<HudStatusDotColor, string> = {
  cyan: "bg-cyan-300",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
};

const glowMap: Record<HudStatusDotColor, string> = {
  cyan: "shadow-[0_0_8px_rgba(34,211,238,0.8)]",
  emerald: "shadow-[0_0_8px_rgba(16,185,129,0.8)]",
  amber: "shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  red: "shadow-[0_0_8px_rgba(248,113,113,0.8)]",
};

/**
 * Dot de status estilo HUD tático com pulso de radar.
 *
 * Visual estático idêntico ao que existia inline.
 * O anel de pulso é a única adição.
 *
 * @example
 * // Status ativo de plantão
 * <HudStatusDot color="cyan" />
 *
 * // Equipe em serviço
 * <HudStatusDot color="emerald" />
 *
 * // Pendência
 * <HudStatusDot color="amber" size={8} pulse={false} />
 */
export function HudStatusDot({
  color,
  size = 6,
  pulse = true,
  className,
}: HudStatusDotProps) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Dot estático central */}
      <span
        className={cn("absolute rounded-full", colorMap[color], glowMap[color])}
        style={{ width: size, height: size }}
      />

      {/* Anel de pulso (ring expandindo e desvanecendo) */}
      {pulse && (
        <span
          className={cn(
            "absolute rounded-full animate-hud-ring-pulse",
            colorMap[color],
          )}
          style={{
            width: size,
            height: size,
          }}
        />
      )}
    </span>
  );
}
