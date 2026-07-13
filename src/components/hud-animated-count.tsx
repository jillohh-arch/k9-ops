"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";

export interface HudAnimatedCountProps {
  /** Valor numérico a ser animado. */
  value: number;
  /**
   * Função de formatação. Recebe o número arredondado e retorna string.
   * Ex: formatCount(1234) => "1.234"
   */
  format?: (n: number) => string;
  /** Classe CSS extra no span do número. */
  className?: string;
}

/**
 * Número animado estilo HUD — conta de 0 (ou do valor anterior) até o valor atual.
 *
 * - Primeira renderização: 0 → valor (ou 0 se prefersReducedMotion)
 * - Updates de snapshot: valor anterior → novo valor
 * - prefersReducedMotion: exibe direto o valor final, sem animação
 *
 * Usa animate() do Framer Motion (tween), sem spring.
 */
export function HudAnimatedCount({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: HudAnimatedCountProps) {
  // MotionValue criados incondicionalmente (Rules of Hooks)
  const motionValue = useMotionValue(value);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [animatedDisplay, setAnimatedDisplay] = useState(() => format(Math.round(value)));
  const prefersReducedMotion = useReducedMotion();

  // Reduced motion: valor derivado diretamente, sem effect
  const reducedMotionDisplay = useMemo(
    () => format(Math.round(value)),
    [format, value],
  );

  // Sincronizar o MotionValue com o novo value (apenas quando animação ativa)
  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value);
      return;
    }

    const node = spanRef.current;
    if (!node) return;

    // Cancelar animações anteriores e animar do valor atual até o novo
    const controls = animate(motionValue, value, {
      duration: 0.3,
      ease: [0.215, 0.61, 0.355, 1],
      onUpdate: (latest) => {
        setAnimatedDisplay(format(Math.round(latest)));
      },
    });

    return () => {
      controls.stop();
    };
  }, [value, format, prefersReducedMotion, motionValue]);

  return (
    <span className={className} ref={spanRef}>
      {prefersReducedMotion ? reducedMotionDisplay : animatedDisplay}
    </span>
  );
}
