"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogProps = {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  open: boolean;
  title: string;
  /** Optional description announced to screen readers */
  description?: string;
};

/**
 * Elements inside the dialog that can actually hold keyboard focus.
 *
 * The `:not([disabled])` filters are the correction: a disabled control matches
 * the tag selectors but can never become `document.activeElement`, so including
 * it made the trap's "am I on the last element?" test unreachable and let Tab
 * escape to the page behind. `[tabindex="-1"]` is excluded for the same reason —
 * it is programmatically focusable but not part of the Tab sequence.
 */
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function collectFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Accessible modal dialog with focus trap, backdrop click dismiss, and Escape key.
 * Follows WAI-ARIA Dialog pattern.
 */
export function Dialog({
  children,
  className,
  description,
  onClose,
  open,
  title,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the element that was focused before opening
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus the dialog container on next frame
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /*
   * Bound to the DOCUMENT while open, not to the dialog element.
   *
   * The second half of MAJOR-V1: as a React `onKeyDown` on the panel, this handler
   * only ran for events originating inside the dialog. Once focus had escaped, no
   * keystroke could reach it, so the leak was one-way and Escape stopped working
   * too. A document listener sees the keystroke wherever focus happens to be, which
   * is what makes the containment check below able to recover.
   */
  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      // Focus trap
      if (event.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;

        const focusable = collectFocusable(container);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        /*
         * Wrap when the focused element is at either end, and also when focus is
         * not inside the dialog at all.
         *
         * That last case is what the browser review caught: the previous query
         * matched DISABLED controls, so when the final match could not hold focus
         * the `active === last` test never fired and Tab walked out to the page
         * behind. `collectFocusable` now excludes them, but the containment check
         * stays as the backstop — if focus is ever outside, the next keystroke
         * brings it back rather than letting it drift further.
         */
        if (!container.contains(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Attach while open, detach on close/unmount so no listener outlives the dialog.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      /*
       * MAJOR-V3 — why this is not `items-center`.
       *
       * With `align-items: center` on an `overflow-y-auto` container, a child
       * taller than the container overflows equally in BOTH directions. `scrollTop`
       * cannot go negative, so the part above the origin is permanently
       * unreachable: at 390x844 the REPLACE panel started at y ≈ -445 and its
       * title, close button and first fields could not be scrolled to.
       *
       * `justify-center` (horizontal) is safe and stays. Vertical centring moves to
       * `my-auto` on the panel: auto margins distribute FREE space, so they centre
       * when there is room and collapse to zero when there is not — the panel then
       * starts at the top padding edge, fully inside the scroll range. Same visual
       * result on desktop, reachable content on short viewports.
       */
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? "dialog-description" : undefined}
        className={cn(
          // `my-auto` replaces the overlay's vertical centring — see the comment on
          // the overlay for why. `h-fit` keeps the panel from being stretched by
          // the flex container once `align-items` is no longer `center`.
          "relative my-auto h-fit w-full max-w-2xl rounded-[28px] border border-cyan-200/15 bg-[#081321] shadow-[0_30px_100px_rgba(0,0,0,0.55)] outline-none",
          className,
        )}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <button
            aria-label="Fechar"
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {description ? (
          <p id="dialog-description" className="sr-only">
            {description}
          </p>
        ) : null}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
