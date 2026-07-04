"use client";

import Image from "next/image";
import { AlertCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONE_TO_COLOR: Record<string, string> = {
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  blue: "text-blue-300",
  amber: "text-amber-300",
  violet: "text-violet-300",
  red: "text-red-300",
  slate: "text-slate-300",
};

/* ─── PngIcon ───
 * Renders a transparent PNG (no own container/background).
 * Uses a static manifest of known icon files; missing entries render a
 * soft lucide fallback in the matching tone color.
 */
const ICON_MANIFEST: Record<string, true> = {
  "/assets/icones/header_ocorrencias.png": true,
  "/assets/icones/header_pendencias.png": true,
  "/assets/icones/pend_assinaturas.png": true,
  "/assets/icones/pend_finalizacao.png": true,
  "/assets/icones/pend_acoes.png": true,
  "/assets/icones/pend_evolucoes.png": true,
  "/assets/icones/equipe_servico.png": true,
};

export function PngIcon({
  alt,
  className,
  fallback: Fallback = AlertCircle,
  fallbackTone = "cyan",
  size = 40,
  src,
}: {
  alt: string;
  className?: string;
  fallback?: LucideIcon;
  fallbackTone?: keyof typeof TONE_TO_COLOR;
  size?: number;
  src: string;
}) {
  const known = ICON_MANIFEST[src] === true;
  if (!known) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          TONE_TO_COLOR[fallbackTone],
          className,
        )}
        style={{ height: size, width: size }}
      >
        <Fallback className="h-6 w-6" />
      </span>
    );
  }

  return (
    <Image
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
      height={size}
      src={src}
      style={{ height: size, width: size }}
      unoptimized
      width={size}
    />
  );
}