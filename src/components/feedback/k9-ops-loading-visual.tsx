"use client";

import { useState } from "react";

export interface K9OpsLoadingVisualProps {
  /** Path do asset de imagem. Default: `/assets/loading/k9_ops_loading_dog_static_v1.png` */
  src?: string;
  /** Classe CSS customizada. */
  className?: string;
  /** Alt descritivo. Default: "Malinois K9 Ops — carregando sistema" */
  alt?: string;
}

/**
 * Elemento visual do carregamento oficial do K9 Ops (Web).
 *
 * Encapsula a renderização do elemento central do Malinois. Na Fase 2A,
 * renderiza o fallback estático oficial (`/assets/loading/k9_ops_loading_dog_static_v1.png`).
 *
 * Na Fase 5, esta abstração responderá pelo Lottie oficial com fallback
 * automático para a imagem estática se o asset animado falhar ou estiver
 * indisponível, sem necessidade de refatorar o `K9OpsLoadingScreen`.
 */
export function K9OpsLoadingVisual({
  src = "/assets/loading/k9_ops_loading_dog_static_v1.png",
  className = "h-36 w-36 sm:h-44 sm:w-44",
  alt = "Malinois K9 Ops — carregando sistema",
}: K9OpsLoadingVisualProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
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
      src={src}
      alt={alt}
      className={`object-contain select-none pointer-events-none ${className}`}
      onError={() => setHasError(true)}
    />
  );
}
