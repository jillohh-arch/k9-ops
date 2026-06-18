"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      // Focus trap
      if (event.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;

        const focusable = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
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
          "relative w-full max-w-2xl rounded-[28px] border border-cyan-200/15 bg-[#081321] shadow-[0_30px_100px_rgba(0,0,0,0.55)] outline-none",
          className,
        )}
        onKeyDown={handleKeyDown}
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
