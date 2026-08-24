/**
 * K9 Ops Web — Health Web v1 HW-6A.I4A
 * ClinicalCaseCard — truthfulness of a single case card, and its ONE interaction.
 *
 * The two load-bearing presentation invariants of this vertical:
 *   1. `null` is NOT `false` and NOT `0` for restriction, pending schedule and
 *      active treatments — three visibly distinct outcomes.
 *   2. `openedAt` is NEVER rendered as "Última atividade". Only `lastEventAt`
 *      may occupy that slot; its absence reads "Sem atividade posterior".
 *
 * Plus the I4B interaction contract, which DELIBERATELY REVERSES the I4A one: the
 * card is no longer a single button. It is an inert container holding TWO SIBLING
 * buttons — a K9 identity action and a case action — because a second control
 * could not be nested inside the first without invalid `<button>`-in-`<button>`
 * markup. The tests below assert the sibling structure directly, since that is
 * what makes the accessibility of the two-target card real rather than patched
 * over with event-propagation tricks.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClinicalCaseReadModel } from "../types";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { ClinicalCaseCard } from "../presentation/clinical-case-card";

function caseModel(
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseReadModel {
  return {
    dogId: "k9-a",
    caseId: "case-1",
    clinicalStatus: "open",
    rawClinicalStatus: "open",
    title: "Claudicação membro posterior",
    openedAt: new Date("2026-03-10T12:00:00Z"),
    openedBy: null,
    recordedBy: null,
    openingEventId: null,
    openingType: null,
    primaryProfessional: null,
    closedAt: null,
    closedBy: null,
    closureType: null,
    closureReason: null,
    hasActiveRestriction: null,
    hasPendingSchedule: null,
    activeTreatmentsCount: null,
    lastEventAt: null,
    eventCount: null,
    schemaVersion: 1,
    dataQuality: "complete",
    issues: [],
    ...overrides,
  };
}

function entryFor(
  overrides: Partial<ClinicalCaseReadModel> = {},
  dog: Partial<ClinicalCaseListEntry["dog"]> = {},
): ClinicalCaseListEntry {
  const item = caseModel(overrides);
  return {
    entryId: `${item.dogId}:${item.caseId}`,
    dogId: item.dogId,
    caseId: item.caseId,
    dog: {
      id: item.dogId,
      name: "Apollo",
      registrationNumber: "K9-001",
      photoUrl: null,
      breed: null,
      sex: null,
      dateOfBirth: null,
      conductor: null,
      specialties: [],
      ...dog,
    },
    case: item,
  };
}

function renderCard(
  overrides: Partial<ClinicalCaseReadModel> = {},
  dog: Partial<ClinicalCaseListEntry["dog"]> = {},
) {
  const onOpenCase = vi.fn();
  const onOpenK9 = vi.fn();
  const utils = render(
    <ul>
      <ClinicalCaseCard
        entry={entryFor(overrides, dog)}
        onOpenCase={onOpenCase}
        onOpenK9={onOpenK9}
      />
    </ul>,
  );
  return { onOpenCase, onOpenK9, ...utils };
}

describe("HW-6A.I4A — ClinicalCaseCard content", () => {
  // 1 — the three tri-state facts, all distinct
  it("1. null, false and zero are three visibly distinct outcomes", () => {
    renderCard({
      hasActiveRestriction: null,
      hasPendingSchedule: false,
      activeTreatmentsCount: 0,
    });

    expect(screen.getByText("Não informado")).toBeInTheDocument();
    expect(screen.getByText("Sem pendência")).toBeInTheDocument();
    expect(screen.getByText("Nenhum")).toBeInTheDocument();
    // An absent flag must never be coloured as a reassuring "no".
    expect(screen.queryByText("Sem restrição")).not.toBeInTheDocument();
  });

  // 2 — affirmed positives
  it("2. affirmed flags and a real treatment count render their own text", () => {
    renderCard({
      hasActiveRestriction: true,
      hasPendingSchedule: true,
      activeTreatmentsCount: 3,
    });

    expect(screen.getByText("Com restrição")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // 3 — THE last-activity rule
  it("3. openedAt is NEVER promoted into the Última atividade slot", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderCard({ openedAt, lastEventAt: null });

    const slot = screen.getByTestId("clinical-card-last-activity");
    expect(slot).toHaveTextContent("Sem atividade posterior");
    expect(slot).not.toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  // 4 — a real lastEventAt is shown as a date
  it("4. a present lastEventAt renders as its own date", () => {
    const lastEventAt = new Date("2026-04-02T12:00:00Z");
    renderCard({ lastEventAt });

    expect(screen.getByTestId("clinical-card-last-activity")).toHaveTextContent(
      lastEventAt.toLocaleDateString("pt-BR"),
    );
  });

  // 5 — all five canonical facts survive on a card
  it("5. all five canonical metadata fields are present in frozen order", () => {
    renderCard();
    const cells = [
      ...screen.getByTestId("clinical-card-metadata").children,
    ].map((c) => c.textContent ?? "");

    expect(cells).toHaveLength(5);
    expect(cells[0]).toContain("Aberto em");
    expect(cells[1]).toContain("Última atividade");
    expect(cells[2]).toContain("Restrição ativa");
    expect(cells[3]).toContain("Agenda pendente");
    expect(cells[4]).toContain("Tratamentos ativos");
  });

  // 6 — §12 nothing was synthesized onto the card
  it("6. the card synthesizes no severity, risk or next-action field", () => {
    const { container } = renderCard();
    const text = container.textContent ?? "";

    for (const invented of [
      "Próxima ação",
      "Severidade",
      "Gravidade",
      "Risco",
      "Prontidão",
      "Score",
    ]) {
      expect(text).not.toContain(invented);
    }
  });

  // 7 — §10 photo source is exactly the institutional field
  it("7. an existing photoUrl renders a real img from dog.photoUrl", () => {
    const url = "https://institutional.example/k9/thor.jpg";
    renderCard({}, { photoUrl: url });
    const photo = screen.getByTestId("clinical-card-k9-photo");

    expect(photo.tagName).toBe("IMG");
    expect(photo).toHaveAttribute("src", url);
    expect(photo.className).toContain("object-cover");
  });

  // 8 — §10 the fallback is truthful and shares the media footprint
  it("8. a missing photo renders a labelled fallback, never a fake photograph", () => {
    renderCard({}, { photoUrl: null });
    const fallback = screen.getByTestId("clinical-card-k9-photo-fallback");

    expect(fallback).toHaveAttribute("role", "img");
    expect(fallback).toHaveAttribute(
      "aria-label",
      "K9 Apollo sem foto cadastrada",
    );
    expect(fallback.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("clinical-card-k9-photo")).not.toBeInTheDocument();
    // Same media footprint as a real photo, so a K9 without a picture does not
    // collapse into a tiny icon.
    expect(fallback.className).toContain("aspect-[4/3]");
    expect(fallback.className).toContain("w-full");
  });

  // 9 — §11 K9 identity is strong and legible
  it("9. the K9 name and MAT are present with a strong name treatment", () => {
    renderCard({}, { name: "Luna", registrationNumber: "K9-2202" });
    const name = screen.getByTestId("clinical-card-k9-name");
    const mat = screen.getByTestId("clinical-card-k9-registration");

    expect(name).toHaveTextContent("Luna");
    expect(name.className).toMatch(/text-\[22px\]/);
    expect(name.className).toMatch(/\bfont-extrabold\b/);
    expect(mat).toHaveTextContent("MAT. K9-2202");
    expect(mat.className).toMatch(/text-\[13px\]/);
    expect(mat.className).toMatch(/\bfont-mono\b/);
  });

  // 10 — MAT is never fabricated
  it("10. a missing MAT stays truthful and never derives from caseId", () => {
    renderCard({}, { registrationNumber: null });
    const mat = screen.getByTestId("clinical-card-k9-registration");

    expect(mat).toHaveTextContent("MAT. não informada");
    expect(mat).not.toHaveTextContent("case-1");
  });

  // 11 — §11 the case title is readable and wraps
  it("11. a long case title wraps instead of truncating", () => {
    const longTitle =
      "Claudicação de membro posterior direito com suspeita de displasia coxofemoral em acompanhamento";
    renderCard({ title: longTitle });
    const titleEl = screen.getByTestId("clinical-card-case-title");

    expect(titleEl).toHaveTextContent(longTitle);
    expect(titleEl.className).toContain("break-words");
    expect(titleEl.className).not.toContain("truncate");
    expect(titleEl.className).not.toContain("line-clamp");
    expect(titleEl.className).toMatch(/\btext-base\b/);
  });

  // 12 — an absent title is labelled, not blank
  it("12. an absent title renders the explicit absence label", () => {
    renderCard({ title: null });
    const titleEl = screen.getByTestId("clinical-card-case-title");

    expect(titleEl.textContent?.trim()).not.toBe("");
    expect(titleEl.className).toContain("italic");
  });

  // 13 — §13 canonical status
  it("13. the canonical status label is rendered", () => {
    renderCard({ clinicalStatus: "under_treatment" });
    expect(screen.getByText("Em Tratamento")).toBeInTheDocument();
  });

  // 14 — §13 unknown status stays visible and is never converted
  it("14. an unrecognized status remains visible as its own outcome", () => {
    renderCard({ clinicalStatus: null, rawClinicalStatus: "quarantine" });
    const chip = screen.getByTestId("clinical-card-status-unknown");

    expect(chip).toHaveTextContent("Status não reconhecido");
    // Never silently promoted to a canonical stage.
    expect(screen.queryByText("Aberto")).not.toBeInTheDocument();
    // And not conveyed by colour alone — it carries an icon.
    expect(chip.querySelector("svg")).not.toBeNull();
  });
});

describe("HW-6A.I4B — ClinicalCaseCard interaction", () => {
  // 1 — §4/§5 the card is a NON-interactive container, not a button.
  //
  // I4A made the whole card a single <button>. I4B DELIBERATELY REVERSES that:
  // the card must host TWO actions, and a <button> cannot legally contain another
  // <button>. So the container is now an inert <article> and the two actions are
  // its sibling children.
  it("1. the card container is a non-interactive article, not a button", () => {
    renderCard();
    const card = screen.getByTestId("clinical-case-card");

    expect(card.tagName).toBe("ARTICLE");
    expect(card).not.toHaveAttribute("onclick");
    expect(card).not.toHaveAttribute("tabindex");
    expect(card).not.toHaveAttribute("role", "button");
  });

  // 2 — §3B the K9 identity action opens the K9 view with THIS entry
  it("2. clicking the K9 identity action requests the K9 view for THIS entry", () => {
    const { onOpenK9, onOpenCase } = renderCard();
    fireEvent.click(screen.getByTestId("clinical-card-k9-action"));

    expect(onOpenK9).toHaveBeenCalledTimes(1);
    expect(onOpenK9.mock.calls[0][0]).toMatchObject({ entryId: "k9-a:case-1" });
    // The two actions are independent: opening the K9 view never opens the case.
    expect(onOpenCase).not.toHaveBeenCalled();
  });

  // 3 — §3A the case action opens the case modal with THIS entry
  it("3. clicking the case action requests the case modal for THIS entry", () => {
    const { onOpenCase, onOpenK9 } = renderCard();
    fireEvent.click(screen.getByTestId("clinical-case-action"));

    expect(onOpenCase).toHaveBeenCalledTimes(1);
    expect(onOpenCase.mock.calls[0][0]).toMatchObject({ entryId: "k9-a:case-1" });
    expect(onOpenK9).not.toHaveBeenCalled();
  });

  // 4 — §4 the two actions are SIBLING <button>s, never nested
  it("4. the two actions are genuine sibling buttons, never nested", () => {
    renderCard();
    const k9 = screen.getByTestId("clinical-card-k9-action");
    const caseAction = screen.getByTestId("clinical-case-action");

    expect(k9.tagName).toBe("BUTTON");
    expect(caseAction.tagName).toBe("BUTTON");
    expect(k9).toHaveAttribute("type", "button");
    expect(caseAction).toHaveAttribute("type", "button");
    // Neither contains the other — no <button> inside a <button>.
    expect(k9.contains(caseAction)).toBe(false);
    expect(caseAction.contains(k9)).toBe(false);
    // And the card holds EXACTLY these two controls, nothing more.
    const card = screen.getByTestId("clinical-case-card");
    expect(card.querySelectorAll("button")).toHaveLength(2);
    expect(card.querySelector("a")).toBeNull();
    expect(card.querySelector("[href]")).toBeNull();
  });

  // 5 — §3B/§28 keyboard activation on both native buttons
  it("5. both actions are keyboard activatable native buttons", () => {
    const { onOpenK9 } = renderCard();
    const k9 = screen.getByTestId("clinical-card-k9-action");

    k9.focus();
    expect(document.activeElement).toBe(k9);
    // Natively in the tab order; needs no explicit tabindex.
    expect(k9).not.toHaveAttribute("tabindex");

    fireEvent.click(k9); // what the browser synthesizes for Enter/Space
    expect(onOpenK9).toHaveBeenCalled();
  });

  // 6 — §3C the K9 action bundles photo + name + MAT as one coherent target
  it("6. the photo, name and MAT belong to the K9 action, not the case action", () => {
    renderCard(
      {},
      { photoUrl: "https://institutional.example/k9/thor.jpg" },
    );
    const photo = screen.getByTestId("clinical-card-k9-photo");
    const name = screen.getByTestId("clinical-card-k9-name");
    const mat = screen.getByTestId("clinical-card-k9-registration");
    const k9 = screen.getByTestId("clinical-card-k9-action");
    const caseAction = screen.getByTestId("clinical-case-action");

    for (const el of [photo, name, mat]) {
      // Each K9-identity element is inside the K9 action, NOT the case action.
      expect(el.closest("button")).toBe(k9);
      expect(caseAction.contains(el)).toBe(false);
      // No nested control of its own.
      expect(el).not.toHaveAttribute("tabindex");
      expect(el).not.toHaveAttribute("role", "button");
      expect(el.closest("a")).toBeNull();
    }
  });

  // 6b — the status/title/metadata belong to the case action
  it("6b. the status, title and metadata belong to the case action", () => {
    const { onOpenK9 } = renderCard();
    const title = screen.getByTestId("clinical-card-case-title");
    const metadata = screen.getByTestId("clinical-card-metadata");
    const caseAction = screen.getByTestId("clinical-case-action");

    for (const el of [title, metadata]) {
      expect(el.closest("button")).toBe(caseAction);
    }
    // Clicking the title opens the case, not the K9 view.
    fireEvent.click(title);
    expect(onOpenK9).not.toHaveBeenCalled();
  });

  // 7 — §7/§22 no K9 navigation and no write affordance leaked in
  it("7. the card exposes exactly two buttons, no link and no edit action", () => {
    const { container } = renderCard();

    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.textContent).not.toContain("Editar");
    expect(container.textContent).not.toContain("Excluir");
  });

  // 8 — §24 each action reflects its own selection independently
  it("8. the two actions reflect case- and K9-selection independently", () => {
    const onOpenCase = vi.fn();
    const onOpenK9 = vi.fn();
    const { rerender } = render(
      <ul>
        <ClinicalCaseCard
          entry={entryFor()}
          onOpenCase={onOpenCase}
          onOpenK9={onOpenK9}
        />
      </ul>,
    );

    let caseAction = screen.getByTestId("clinical-case-action");
    let k9 = screen.getByTestId("clinical-card-k9-action");
    let card = screen.getByTestId("clinical-case-card");
    expect(caseAction).toHaveAttribute("aria-expanded", "false");
    expect(k9).toHaveAttribute("aria-expanded", "false");
    expect(card.className).not.toContain("border-cyan-300/60");

    // Case selected -> only the case action is expanded, card emphasized.
    rerender(
      <ul>
        <ClinicalCaseCard
          entry={entryFor()}
          onOpenCase={onOpenCase}
          onOpenK9={onOpenK9}
          caseSelected
        />
      </ul>,
    );
    caseAction = screen.getByTestId("clinical-case-action");
    k9 = screen.getByTestId("clinical-card-k9-action");
    card = screen.getByTestId("clinical-case-card");
    expect(caseAction).toHaveAttribute("aria-expanded", "true");
    expect(k9).toHaveAttribute("aria-expanded", "false");
    expect(card.className).toContain("border-cyan-300/60");

    // K9 selected -> only the K9 action is expanded, card emphasized.
    rerender(
      <ul>
        <ClinicalCaseCard
          entry={entryFor()}
          onOpenCase={onOpenCase}
          onOpenK9={onOpenK9}
          k9Selected
        />
      </ul>,
    );
    caseAction = screen.getByTestId("clinical-case-action");
    k9 = screen.getByTestId("clinical-card-k9-action");
    card = screen.getByTestId("clinical-case-card");
    expect(caseAction).toHaveAttribute("aria-expanded", "false");
    expect(k9).toHaveAttribute("aria-expanded", "true");
    expect(card.className).toContain("border-cyan-300/60");
  });

  // 9 — §3B/§28 each action carries its own descriptive accessible name
  it("9. each action has its own accessible name and haspopup", () => {
    renderCard({ title: "Otite externa" }, { name: "Luna" });
    const k9 = screen.getByTestId("clinical-card-k9-action");
    const caseAction = screen.getByTestId("clinical-case-action");

    expect(k9).toHaveAttribute("aria-label", "Visão clínica do K9 Luna");
    expect(k9).toHaveAttribute("aria-haspopup", "dialog");
    expect(caseAction).toHaveAttribute(
      "aria-label",
      "Caso clínico de Luna: Otite externa",
    );
    expect(caseAction).toHaveAttribute("aria-haspopup", "dialog");
  });

  // 10 — §16 the card itself renders no dialog; the view owns the modals
  it("10. the card itself renders no dialog", () => {
    const { container } = renderCard();

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
  });

  // 11 — §3B/§16 both actions carry a visible focus ring and pointer affordance
  it("11. both actions carry a focus ring and a pointer affordance", () => {
    renderCard();
    for (const testId of ["clinical-card-k9-action", "clinical-case-action"]) {
      const action = screen.getByTestId(testId);
      expect(action.className).toContain("focus-visible:ring");
      expect(action.className).toContain("cursor-pointer");
    }
  });
});
