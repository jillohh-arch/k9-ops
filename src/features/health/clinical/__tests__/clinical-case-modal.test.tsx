/**
 * K9 Ops Web — Health Web v1 HW-6A.I4A
 * ClinicalCaseModal — the case SUMMARY dialog.
 *
 * Two kinds of assertion here, and the negative ones matter as much as the
 * positive ones:
 *
 * 1. What it SHOWS must be truthful — only fields already on the composed entry,
 *    with `null` never collapsing into `false`/`0`, and `openedAt` never
 *    occupying the "Última atividade" slot.
 *
 * 2. What it must NOT show — the approved mockup drew Histórico/timeline,
 *    Documentos, Tratamento, Observações and "Editar caso". §21/§22/§23 forbid all
 *    of them in I4A, including a DISABLED edit button, because a greyed-out
 *    control still advertises a capability that does not exist. These tests are
 *    what stops a later slice from quietly re-adding them.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClinicalCaseReadModel } from "../types";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { ClinicalCaseModal } from "../presentation/clinical-case-modal";

function caseModel(
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseReadModel {
  return {
    dogId: "k9-a",
    caseId: "case-1",
    clinicalStatus: "under_treatment",
    rawClinicalStatus: "under_treatment",
    title: "Otite externa bilateral",
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
      name: "Luna",
      registrationNumber: "K9-2202",
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

function renderModal(
  overrides: Partial<ClinicalCaseReadModel> = {},
  dog: Partial<ClinicalCaseListEntry["dog"]> = {},
) {
  const onClose = vi.fn();
  const utils = render(
    <ClinicalCaseModal entry={entryFor(overrides, dog)} onClose={onClose} />,
  );
  return { onClose, ...utils };
}

describe("HW-6A.I4A — ClinicalCaseModal dialog semantics", () => {
  // 1 — §18/§28 accessible dialog semantics come from the shared primitive
  it("1. renders an accessible modal dialog", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Labelled, so a screen reader announces what opened.
    expect(dialog.getAttribute("aria-label")).toBeTruthy();
  });

  // 2 — nothing renders without a selected case
  it("2. renders nothing when no case is selected", () => {
    const { container } = render(
      <ClinicalCaseModal entry={null} onClose={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 3 — §18/§23 a labelled close control exists
  it("3. exposes a labelled close control that closes the dialog", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 4 — §18/§28 Escape closes
  it("4. Escape closes the dialog", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 5 — §18 backdrop dismiss, from the shared primitive
  it("5. clicking the backdrop closes the dialog", () => {
    const { onClose } = renderModal();
    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 6 — §18/§28 focus moves into the dialog when it opens
  it("6. focus moves into the dialog panel on open", async () => {
    renderModal();
    const dialog = screen.getByRole("dialog");

    // The primitive focuses the panel on the next frame.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(dialog).toHaveFocus();
  });
});

describe("HW-6A.I4A — ClinicalCaseModal data contract", () => {
  // 1 — §19/§20 K9 identity
  it("1. shows the K9 name, MAT and canonical status", () => {
    renderModal();

    expect(screen.getByTestId("clinical-modal-k9-name")).toHaveTextContent("Luna");
    expect(screen.getByTestId("clinical-modal-k9-registration")).toHaveTextContent(
      "MAT. K9-2202",
    );
    expect(screen.getByText("Em Tratamento")).toBeInTheDocument();
  });

  // 2 — §20 photo is the institutional field only
  it("2. the photo comes from dog.photoUrl", () => {
    const url = "https://institutional.example/k9/luna.jpg";
    renderModal({}, { photoUrl: url });
    const photo = screen.getByTestId("clinical-modal-k9-photo");

    expect(photo.tagName).toBe("IMG");
    expect(photo).toHaveAttribute("src", url);
    expect(photo.className).toContain("object-cover");
  });

  // 3 — truthful fallback, never a fabricated photograph
  it("3. a missing photo renders a labelled fallback", () => {
    renderModal({}, { photoUrl: null });
    const fallback = screen.getByTestId("clinical-modal-k9-photo-fallback");

    expect(fallback).toHaveAttribute("role", "img");
    expect(fallback).toHaveAttribute("aria-label", "K9 Luna sem foto cadastrada");
    expect(fallback.querySelector("img")).toBeNull();
    expect(
      screen.queryByTestId("clinical-modal-k9-photo"),
    ).not.toBeInTheDocument();
  });

  // 4 — MAT is never fabricated
  it("4. a missing MAT stays truthful", () => {
    renderModal({}, { registrationNumber: null });
    const mat = screen.getByTestId("clinical-modal-k9-registration");

    expect(mat).toHaveTextContent("MAT. não informada");
    expect(mat).not.toHaveTextContent("case-1");
  });

  // 5 — §20 the case subject and its date
  it("5. shows the case title and opened-at date", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderModal({ title: "Otite externa bilateral", openedAt });

    expect(screen.getByTestId("clinical-modal-case-title")).toHaveTextContent(
      "Otite externa bilateral",
    );
    expect(
      screen.getByTestId("clinical-modal-case-section"),
    ).toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  // 6 — THE last-activity rule, restated in the modal
  it("6. openedAt is NEVER promoted into Última atividade", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderModal({ openedAt, lastEventAt: null });

    const slot = screen.getByTestId("clinical-modal-last-activity");
    expect(slot).toHaveTextContent("Sem atividade posterior");
    expect(slot).not.toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  // 7 — null / false / 0 stay three distinct outcomes
  it("7. null, false and zero remain visibly distinct", () => {
    renderModal({
      hasActiveRestriction: null,
      hasPendingSchedule: false,
      activeTreatmentsCount: 0,
      // Pinned so the only "Não informado" under test is the restriction one.
      eventCount: 3,
    });

    const situation = screen.getByTestId("clinical-modal-situation-section");
    expect(situation).toHaveTextContent("Não informado");
    expect(screen.getByText("Sem pendência")).toBeInTheDocument();
    expect(screen.getByText("Nenhum")).toBeInTheDocument();
    // An absent flag must never be coloured as a reassuring "no".
    expect(screen.queryByText("Sem restrição")).not.toBeInTheDocument();
  });

  // 8 — affirmed values
  it("8. affirmed flags and counts render their own text", () => {
    renderModal({
      hasActiveRestriction: true,
      hasPendingSchedule: true,
      activeTreatmentsCount: 2,
    });

    expect(screen.getByText("Com restrição")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  // 9 — §20 eventCount is a COUNT, and null is not a false zero
  it("9. eventCount renders as a count, and null is not zero", () => {
    const withCount = renderModal({ eventCount: 4 });
    expect(screen.getByTestId("clinical-modal-event-count")).toHaveTextContent("4");
    withCount.unmount();

    renderModal({ eventCount: null });
    const slot = screen.getByTestId("clinical-modal-event-count");
    expect(slot).toHaveTextContent("Não informado");
    expect(slot).not.toHaveTextContent("0");
  });

  // 10 — an unrecognized status stays visible in the modal too
  it("10. an unrecognized status is shown as its own outcome", () => {
    renderModal({ clinicalStatus: null, rawClinicalStatus: "quarantine" });

    expect(screen.getByTestId("clinical-card-status-unknown")).toHaveTextContent(
      "Status não reconhecido",
    );
  });

  // 11 — an absent title is labelled, not blank or invented
  it("11. an absent title renders the explicit absence label", () => {
    renderModal({ title: null });
    const titleEl = screen.getByTestId("clinical-modal-case-title");

    expect(titleEl.textContent?.trim()).not.toBe("");
    expect(titleEl.className).toContain("italic");
  });

  // 12 — the modal states the boundary of what it is showing
  it("12. the modal states that it is a summary of the authorized read", () => {
    renderModal();

    expect(screen.getByTestId("clinical-modal-scope-note")).toHaveTextContent(
      /Resumo baseado apenas nos dados já disponíveis/i,
    );
  });
});

describe("HW-6A.I4A — ClinicalCaseModal explicitly NOT implemented", () => {
  /**
   * The rendered text MINUS the scope note.
   *
   * The scope note deliberately NAMES what is absent ("Histórico de eventos,
   * documentos e edição clínica não fazem parte desta visualização"), so a raw
   * substring scan over the whole dialog would match the very disclaimer that
   * proves the feature is missing. These tests assert there is no such SECTION,
   * so the disclaimer is excluded and asserted separately below.
   */
  function bodyTextWithoutScopeNote(container: HTMLElement): string {
    const note = container.querySelector(
      '[data-testid="clinical-modal-scope-note"]',
    );
    const noteText = note?.textContent ?? "";
    const full = container.textContent ?? "";
    return noteText ? full.split(noteText).join("") : full;
  }

  // 1 — §21 no timeline, however pretty it looked in the mock
  it("1. renders no event timeline or history section", () => {
    const { container } = renderModal({ eventCount: 6 });
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Histórico");
    expect(text).not.toContain("Linha do tempo");
    expect(text).not.toContain("Timeline");
    // eventCount is allowed as a COUNT, but it must not become a list of events.
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  // 1b — and the disclaimer that names the absence is itself present
  it("1b. the scope note states the timeline is not part of this view", () => {
    renderModal();
    expect(screen.getByTestId("clinical-modal-scope-note")).toHaveTextContent(
      /Histórico de eventos, documentos e edição clínica não fazem parte/i,
    );
  });

  // 2 — §21 no documents
  it("2. renders no documents section", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Documento");
    expect(text).not.toContain("Anexo");
  });

  // 3 — §22 NO edit action, and no disabled fake either
  it("3. renders no edit action and no disabled edit affordance", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Editar");
    expect(text).not.toContain("Excluir");
    expect(text).not.toContain("Cancelar caso");
    // A disabled control still advertises a capability that does not exist.
    expect(container.querySelector("button[disabled]")).toBeNull();
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
  });

  // 4 — §21/§22 no treatment or observation workflow
  it("4. renders no treatment or observations workflow", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    // "Tratamentos ativos" is an allowed COUNT label; a "Tratamento" workflow
    // section is not.
    expect(text).not.toContain("Observações");
    expect(text).not.toContain("Adicionar");
    expect(text).not.toContain("Registrar");
    expect(text).not.toContain("Novo evento");
  });

  // 5 — §23 the ONLY control is the close control
  it("5. the close control is the only control in the dialog", () => {
    const { container } = renderModal();
    const buttons = [...container.querySelectorAll("button")];

    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "Fechar");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    // No form control: this is a read-only summary.
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  // 6 — §20 no invented clinical prose
  it("6. invents no clinical narrative beyond the read model", () => {
    const { container } = renderModal({ title: "Otite externa bilateral" });
    const text = bodyTextWithoutScopeNote(container);

    // The mock showed prose like "Dor e claudicação grau 2/5"; nothing of the
    // sort may be synthesized.
    expect(text).not.toMatch(/grau \d\/\d/i);
    expect(text).not.toContain("Diagnóstico");
    expect(text).not.toContain("Prognóstico");
    expect(text).not.toContain("Conduta");
  });
});

describe("HW-6A.I4A — ClinicalCaseModal source purity", () => {
  // §8/§31 the modal performs NO read of its own
  it("1. the modal file imports no data-access surface", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../presentation/clinical-case-modal.tsx"),
      "utf8",
    );

    for (const forbidden of [
      "firebase/firestore",
      "firebase/functions",
      "@/lib/firebase/client",
      "getDocs",
      "collection(",
      "httpsCallable",
      "loadClinicalScope",
      "readClinicalCasesForDog",
      "useClinicalCases",
    ]) {
      expect(source, `modal must not reference ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });
});
