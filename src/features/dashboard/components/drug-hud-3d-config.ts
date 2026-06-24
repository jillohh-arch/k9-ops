/**
 * 3D configuration for the "Drogas apreendidas" podium.
 *
 * Every knob is centralised here so the demo can be tuned in a single
 * place without touching component code:
 *
 *   - `DRUG_HUD_3D_INTENSITY` (0.0..1.5, default 1.0)
 *       Master volume for the visual effect. Applied to Bloom
 *       intensity, particle count and the pulse of the core. Drop
 *       this on equipment that struggles to keep up.
 *
 *   - `DRUG_HUD_3D_FORCE_FALLBACK` (default false)
 *       When true, skips the 3D component entirely and renders the
 *       CSS-only fallback. Useful for screenshots or to recover from
 *       a broken build without redeploying.
 *
 *   - `DRUG_HUD_3D_MOBILE_QUERY` (default "(max-width: 768px), (pointer: coarse)")
 *       matchMedia expression that, when matched, forces the
 *       fallback. Mobile and touch-primary devices skip the 3D
 *       pipeline to avoid locking up on weak GPUs.
 *
 * The constants are plain exports (not env vars) on purpose — the
 * demo equipment is decided last-minute, and editing a single
 * constant is faster than wiring a build-time flag.
 */

export const DRUG_HUD_3D_INTENSITY = 1.0;

export const DRUG_HUD_3D_FORCE_FALLBACK = false;

export const DRUG_HUD_3D_MOBILE_QUERY =
  "(max-width: 768px), (pointer: coarse)";

/** Bloom strength derived from the master intensity. Clamped to keep
 *  the post-processing pass readable on dark backgrounds. */
export function drugHudBloomIntensity(master: number = DRUG_HUD_3D_INTENSITY) {
  return Math.max(0, Math.min(1.5, 0.6 * master));
}

/** Number of floating particles around the podium. */
export function drugHudParticleCount(master: number = DRUG_HUD_3D_INTENSITY) {
  return Math.round(40 + 60 * Math.max(0, Math.min(1.5, master)));
}

/** Camera distance multiplier — closer = more dramatic. */
export function drugHudCameraDistance(master: number = DRUG_HUD_3D_INTENSITY) {
  return 4.5 - 0.3 * Math.max(0, Math.min(1.5, master));
}
