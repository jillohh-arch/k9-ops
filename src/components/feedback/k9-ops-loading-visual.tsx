"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface K9OpsLoadingVisualProps {
  /** Path do asset de imagem customizado/override. Se não fornecido, usa o padrão oficial. */
  src?: string;
  /** Classe CSS customizada. */
  className?: string;
  /** Alt descritivo. Default: "Malinois K9 Ops — carregando sistema" */
  alt?: string;
}

const OFFICIAL_ANIMATED_WEBP =
  "/assets/loading/k9_ops_loading_dog_animated.webp";
const OFFICIAL_STATIC_PNG =
  "/assets/loading/k9_ops_loading_dog_static_v1.png";

/**
 * Elemento visual do carregamento oficial do K9 Ops (Web).
 *
 * Encapsula a renderização do elemento central do Malinois. Na Fase 5D.1,
 * prefere o Animated WebP oficial (`/assets/loading/k9_ops_loading_dog_animated.webp`).
 *
 * Se `prefers-reduced-motion: reduce` estiver ativo (`useReducedMotion`) ou se o
 * carregamento do WebP falhar, reverte automaticamente para o PNG estático oficial
 * (`/assets/loading/k9_ops_loading_dog_static_v1.png`). Se o PNG também falhar
 * (ou se um `src` customizado falhar), renderiza o SVG neutro de fallback.
 */
export function K9OpsLoadingVisual({
  src,
  className = "h-44 w-44 sm:h-56 sm:w-56 md:h-64 md:w-64 lg:h-72 lg:w-72",
  alt = "Malinois K9 Ops — carregando sistema",
}: K9OpsLoadingVisualProps) {
  const shouldReduceMotion = useReducedMotion();
  const [hasAnimatedWebpError, setHasAnimatedWebpError] = useState(false);
  const [hasStaticPngError, setHasStaticPngError] = useState(false);

  const isCustomSrc = src !== undefined;

  let activeSrc: string;
  if (isCustomSrc) {
    activeSrc = src;
  } else if (shouldReduceMotion || hasAnimatedWebpError) {
    activeSrc = OFFICIAL_STATIC_PNG;
  } else {
    activeSrc = OFFICIAL_ANIMATED_WEBP;
  }

  const handleImageError = () => {
    if (isCustomSrc) {
      setHasStaticPngError(true);
    } else if (!shouldReduceMotion && !hasAnimatedWebpError) {
      setHasAnimatedWebpError(true);
    } else {
      setHasStaticPngError(true);
    }
  };

  if (hasStaticPngError) {
    return (
      <svg
        className="h-20 w-20 text-cyan-400/40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
        <path
          d="M8 14c0-2 1.5-3.5 4-3.5S16 12 16 14M9.5 9.5h.01M14.5 9.5h.01"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={activeSrc}
      alt={alt}
      className={`object-contain select-none pointer-events-none ${className}`}
      onError={handleImageError}
    />
  );
}
