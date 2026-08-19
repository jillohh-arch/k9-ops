import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "../dialog";

/**
 * WEB-01 VISUAL CORRECTIONS V1 — proofs for the two defects the browser review
 * found in the shared Dialog primitive.
 *
 * Scope note on fidelity: jsdom does not lay out or paint, so it cannot prove the
 * geometry finding (MAJOR-V3) by measurement — the real browser retest is the
 * authority for that. What jsdom CAN prove faithfully is the focus-trap logic,
 * because that is pure DOM traversal over `querySelectorAll` and `activeElement`.
 * The class-level assertion below is a structural guard against regressing the
 * overlay back to the clipping layout, not a substitute for the browser.
 */
describe("Dialog — focus containment (MAJOR-V1)", () => {
  /**
   * The regression the browser found.
   *
   * The trap keys on `document.activeElement === last`. When the last matching
   * element is DISABLED it can never hold focus, so that comparison never becomes
   * true and Tab walks straight out of the dialog into the page behind.
   *
   * WEB-01B.7R made this the common case rather than an edge case: submit, retry
   * and form fields are all disabled in the uncertain, stale-authority and
   * retry-owned states.
   */
  it("keeps Tab inside the dialog when the last focusable control is disabled", () => {
    render(
      <div>
        <button type="button" data-testid="behind">
          Cancelar plano
        </button>
        <Dialog open onClose={vi.fn()} title="Editar">
          <input data-testid="first" />
          <button type="button" data-testid="middle">
            Meio
          </button>
          {/* Disabled, exactly like a locked submit after a retryable failure. */}
          <button type="button" disabled data-testid="last-disabled">
            Salvar
          </button>
        </Dialog>
      </div>,
    );

    const middle = screen.getByTestId("middle");
    middle.focus();
    expect(document.activeElement).toBe(middle);

    /*
     * Tab from the last ENABLED control must wrap back inside, not escape.
     *
     * Asserting containment rather than a specific element on purpose: the
     * primitive renders its own close button ahead of `children`, so the first
     * focusable is that button, not the first child. Containment is the invariant
     * that actually matters and does not encode the header's DOM order.
     */
    fireEvent.keyDown(middle, { key: "Tab" });

    expect(document.activeElement).not.toBe(screen.getByTestId("behind"));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("keeps Shift+Tab inside the dialog and never reaches the page behind", () => {
    render(
      <div>
        <button type="button" data-testid="behind">
          Cancelar plano
        </button>
        <Dialog open onClose={vi.fn()} title="Editar">
          <input data-testid="first" />
          <button type="button" disabled data-testid="last-disabled">
            Salvar
          </button>
        </Dialog>
      </div>,
    );

    const first = screen.getByTestId("first");
    first.focus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    // Wraps to the last ENABLED control — the close button — not to the page.
    expect(document.activeElement).not.toBe(screen.getByTestId("behind"));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  /**
   * Recovery: the original handler lived only on the dialog element, so once focus
   * had escaped, no further keystroke could bring it back — the leak was one-way.
   */
  it("pulls focus back when a keystroke arrives while focus sits outside", () => {
    render(
      <div>
        <button type="button" data-testid="behind">
          Cancelar plano
        </button>
        <Dialog open onClose={vi.fn()} title="Editar">
          <input data-testid="first" />
        </Dialog>
      </div>,
    );

    const behind = screen.getByTestId("behind");
    behind.focus();
    expect(document.activeElement).toBe(behind);

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).not.toBe(behind);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("ignores disabled controls when choosing where to wrap", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Editar">
        <input disabled data-testid="disabled-input" />
        <button type="button" data-testid="only-enabled">
          Único
        </button>
        <textarea disabled data-testid="disabled-textarea" />
      </Dialog>,
    );

    const only = screen.getByTestId("only-enabled");
    only.focus();
    fireEvent.keyDown(only, { key: "Tab" });

    // Never parks focus on a disabled control.
    expect(document.activeElement).not.toBe(screen.getByTestId("disabled-input"));
    expect(document.activeElement).not.toBe(screen.getByTestId("disabled-textarea"));
  });

  it("still closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Editar">
        <input data-testid="first" />
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByTestId("first"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * MAJOR-V3 — structural guard only.
 *
 * A flex child taller than an `overflow-y-auto` container centred with
 * `align-items: center` overflows equally in both directions, and `scrollTop`
 * cannot go negative, so the top region becomes permanently unreachable. That is
 * the `y ≈ -445` the browser measured on REPLACE at 390x844.
 *
 * `margin: auto` centres via free-space distribution instead: when there is room
 * it behaves like centring, and when there is not the margins collapse to zero and
 * the child starts at the top, fully within scroll range.
 *
 * jsdom cannot measure this, so these assertions only pin the mechanism in place.
 * The browser retest is the real proof.
 */
describe("Dialog — tall content reachability (MAJOR-V3)", () => {
  it("does not centre the panel with align-items, which would clip its top", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Substituir plano">
        <input data-testid="first" />
      </Dialog>,
    );

    const overlay = screen.getByRole("presentation");
    expect(overlay.className).not.toMatch(/\bitems-center\b/);
    expect(overlay.className).toMatch(/overflow-y-auto/);
  });

  it("centres the panel with auto margins so overflow stays scrollable", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Substituir plano">
        <input data-testid="first" />
      </Dialog>,
    );

    expect(screen.getByRole("dialog").className).toMatch(/\bmy-auto\b/);
  });
});
