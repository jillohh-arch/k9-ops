/**
 * Motion tokens — espelho do mobile (HudDurations / HudCurves).
 *
 * FONTE DE VERDADE: tokens --hud-* em globals.css.
 * Este arquivo existe para uso no Framer Motion e CSS-in-JS.
 * Manter em sincronia com globals.css.
 */

import type { Transition } from "framer-motion";

/* ─── Durações (em segundos para Framer Motion) ─── */

export const hudDurations = {
  micro: 0.08,   // 80ms — stagger step
  tap: 0.12,     // 120ms — press feedback
  fast: 0.16,    // 160ms — chips, selções, hovers
  normal: 0.22,  // 220ms — switches de conteúdo
  entry: 0.3,    // 300ms — entrada de elementos
  pulse: 1.6,    // 1600ms — ciclo de pulso de status
} as const;

/* ─── Curvas de easing (arrays para Framer Motion cubicBezier) ─── */

export const hudEasings = {
  /**
   * easeOutCubic — saída rápida, desacelera.
   * Uso: entrada de elementos.
   */
  enter: [0.215, 0.61, 0.355, 1] as const,

  /**
   * easeInCubic — aceleração progressiva.
   * Uso: saída de elementos.
   */
  exit: [0.55, 0.055, 0.675, 0.19] as const,

  /**
   * easeInOutCubic — acelera e desacelera.
   * Uso: transições bidirecionais.
   */
  move: [0.645, 0.045, 0.355, 1] as const,

  /**
   * easeOutQuart — saída bem seca, sem bounce.
   * Uso: hover rápido, feedback tátil.
   */
  snappy: [0.165, 0.84, 0.44, 1] as const,
} as const;

/* ─── Variants reutilizáveis ─── */

/**
 * Variant de entrada: fade 0→1 + translateY 12px→0.
 * Duração: 300ms, easing: easeOutCubic.
 *
 * Para stagger em container: usar hudStagger().
 */
export const hudEntry = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: hudDurations.entry,
      ease: hudEasings.enter,
    },
  },
} as const;

/**
 * Variant de saída: fade 1→0 + translateY 0→-8px.
 * Duração: 200ms, easing: easeInCubic.
 */
export const hudExit = {
  visible: { opacity: 1, y: 0 },
  hidden: {
    opacity: 0,
    y: -8,
    transition: {
      duration: hudDurations.fast,
      ease: hudEasings.exit,
    },
  },
} as const;

/**
 * Cria transition com staggerChildren para containers.
 *
 * @param delayStep - Delay em segundos entre cada child (default 0.06 = 60ms)
 */
export function hudStagger(delayStep = 0.06) {
  return {
    visible: {
      transition: {
        staggerChildren: delayStep,
        delayChildren: 0,
      },
    },
  } as const;
}

/**
 * Transition base para animações de hover/press.
 * Rápido, seco, sem overshoot.
 */
export const hudTapTransition = {
  duration: hudDurations.tap,
  ease: hudEasings.snappy,
} as const;

/**
 * Transition base para animações de hover (não-press).
 */
export const hudHoverTransition = {
  duration: hudDurations.fast,
  ease: hudEasings.snappy,
} as const;

/**
 * Combina com Transition do Framer Motion para uso em components.
 */
export const hudTransition = {
  enter: {
    duration: hudDurations.entry,
    ease: hudEasings.enter,
  },
  exit: {
    duration: hudDurations.fast,
    ease: hudEasings.exit,
  },
  common: {
    duration: hudDurations.normal,
    ease: hudEasings.move,
  },
} satisfies Record<string, Transition>;
