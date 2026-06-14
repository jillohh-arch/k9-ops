/**
 * Shared CSS class constants for form elements.
 *
 * Variants are composable — combine the base with optional modifier strings.
 */

/** Base input class used across admin forms and pages. */
export const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

/** Modifier: adds focus background highlight. */
export const inputFocusBg = "focus:bg-white/[0.05]";

/** Modifier: disabled visual state. */
export const inputDisabled = "disabled:cursor-not-allowed disabled:opacity-55";

/** Full input class with focus background (k9, human, curriculums). */
export const inputClassFocusBg = `${inputClass} ${inputFocusBg}`;

/** Full input class with focus bg + disabled state (curriculums). */
export const inputClassFull = `${inputClass} ${inputFocusBg} ${inputDisabled}`;

/** Select element class (input + appearance-none). */
export const selectClass = `${inputClass} appearance-none`;

/** Select element class with focus background. */
export const selectClassFocusBg = `${inputClassFocusBg} appearance-none`;

/** Base textarea class. */
export const textareaClass =
  "min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

/** Textarea with focus bg + disabled (curriculums). */
export const textareaClassFull = `${textareaClass} ${inputFocusBg} ${inputDisabled}`;

/** Variant used in health forms (text-white instead of text-slate-100). */
export const inputClassHealth =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";
