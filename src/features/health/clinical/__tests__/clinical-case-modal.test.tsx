/**
 * K9 Ops Web — Health Web v1 HW-6A.I4A + HW-6B.I1
 * ClinicalCaseModal — the case SUMMARY and TIMELINE dialog.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    status: "ready",
    profile: { status: "active", permissions: { health: { read: true } } },
  }),
}));

vi.mock("../hooks/use-clinical-case-events", () => ({
  useClinicalCaseEvents: () => ({
    state: { status: "empty", query: "test" },
    authorityStatus: "allowed",
    refresh: vi.fn(),
    loadAmendmentsForEvent: vi.fn(),
    amendmentsState: {},
  }),
}));

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

describe("HW-6A.I4A + HW-6B.I1 — ClinicalCaseModal dialog semantics", () => {
  it("1. renders an accessible modal dialog", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("2. displays K9 identity: name, registration, photo and status chip", () => {
    renderModal({}, { photoUrl: "https://example.com/luna.jpg" });

    expect(screen.getByTestId("clinical-modal-k9-name")).toHaveTextContent("Luna");
    expect(
      screen.getByTestId("clinical-modal-k9-registration"),
    ).toHaveTextContent("MAT. K9-2202");
    expect(screen.getByTestId("clinical-modal-k9-photo")).toBeInTheDocument();
    expect(screen.getByText("Em Tratamento")).toBeInTheDocument();
  });

  it("3. falls back gracefully when K9 photo is absent", () => {
    renderModal({}, { photoUrl: null });

    expect(
      screen.getByTestId("clinical-modal-k9-photo-fallback"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-modal-k9-photo")).toBeNull();
  });

  it("4. falls back gracefully when registration number is absent", () => {
    renderModal({}, { registrationNumber: null });

    expect(
      screen.getByTestId("clinical-modal-k9-registration"),
    ).toHaveTextContent("MAT. não informada");
  });

  it("5. displays case title and opening date truthfully", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderModal({ openedAt, title: "Otite externa bilateral" });

    expect(screen.getByTestId("clinical-modal-case-title")).toHaveTextContent(
      "Otite externa bilateral",
    );
    expect(
      screen.getByTestId("clinical-modal-case-section"),
    ).toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  it("6. openedAt is NEVER promoted into Última atividade", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderModal({ openedAt, lastEventAt: null });

    const slot = screen.getByTestId("clinical-modal-last-activity");
    expect(slot).toHaveTextContent("Sem atividade posterior");
    expect(slot).not.toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  it("7. null, false and zero remain visibly distinct", () => {
    renderModal({
      hasActiveRestriction: null,
      hasPendingSchedule: false,
      activeTreatmentsCount: 0,
      eventCount: 3,
    });

    const situation = screen.getByTestId("clinical-modal-situation-section");
    expect(situation).toHaveTextContent("Não informado");
    expect(screen.getByText("Sem pendência")).toBeInTheDocument();
    expect(screen.getByText("Nenhum")).toBeInTheDocument();
    expect(screen.queryByText("Sem restrição")).not.toBeInTheDocument();
  });

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

  it("9. eventCount renders as a count, and null is not zero", () => {
    const withCount = renderModal({ eventCount: 4 });
    expect(screen.getByTestId("clinical-modal-event-count")).toHaveTextContent("4");
    withCount.unmount();

    renderModal({ eventCount: null });
    const slot = screen.getByTestId("clinical-modal-event-count");
    expect(slot).toHaveTextContent("Não informado");
    expect(slot).not.toHaveTextContent("0");
  });

  it("10. an unrecognized status is shown as its own outcome", () => {
    renderModal({ clinicalStatus: null, rawClinicalStatus: "quarantine" });

    expect(screen.getByTestId("clinical-card-status-unknown")).toHaveTextContent(
      "Status não reconhecido",
    );
  });

  it("11. an absent title renders the explicit absence label", () => {
    renderModal({ title: null });
    const titleEl = screen.getByTestId("clinical-modal-case-title");

    expect(titleEl.textContent?.trim()).not.toBe("");
    expect(titleEl.className).toContain("italic");
  });

  it("12. the modal states that it is a summary of the authorized read", () => {
    renderModal();

    expect(screen.getByTestId("clinical-modal-scope-note")).toHaveTextContent(
      /Resumo baseado apenas nos dados já disponíveis/i,
    );
  });
});

describe("HW-6B.I1 — ClinicalCaseModal Timeline & Scope Boundaries", () => {
  function bodyTextWithoutScopeNote(container: HTMLElement): string {
    const note = container.querySelector(
      '[data-testid="clinical-modal-scope-note"]',
    );
    const noteText = note?.textContent ?? "";
    const full = container.textContent ?? "";
    return noteText ? full.split(noteText).join("") : full;
  }

  it("1. renders Eventos clínicos section strictly without claiming complete history", async () => {
    const { container } = renderModal({ eventCount: 6 });
    const heading = await screen.findByText("Eventos clínicos");
    expect(heading).toBeInTheDocument();

    const text = bodyTextWithoutScopeNote(container);
    expect(text).not.toContain("Histórico completo do caso");
    expect(text).not.toContain("Linha do tempo");
    expect(text).not.toContain("Timeline");
  });

  it("1b. the scope note states documents and clinical editing are not part of this view", () => {
    renderModal();
    expect(screen.getByTestId("clinical-modal-scope-note")).toHaveTextContent(
      /Documentos e edição clínica não fazem parte/i,
    );
  });

  it("2. renders no documents section", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Documento");
  });

  it("3. renders no edit action and no disabled edit affordance", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Editar");
    expect(text).not.toContain("Excluir");
    expect(text).not.toContain("Cancelar caso");
    expect(container.querySelector("button[disabled]")).toBeNull();
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
  });

  it("4. renders no unauthorized treatment or observation creation workflow", () => {
    const { container } = renderModal();
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toContain("Adicionar");
    expect(text).not.toContain("Novo evento");
  });

  it("5. dialog contains close control and read-only controls only", () => {
    const { container } = renderModal();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("6. invents no clinical narrative beyond the read model", () => {
    const { container } = renderModal({ title: "Otite externa bilateral" });
    const text = bodyTextWithoutScopeNote(container);

    expect(text).not.toMatch(/grau \d\/\d/i);
    expect(text).not.toContain("Diagnóstico:");
    expect(text).not.toContain("Prognóstico");
    expect(text).not.toContain("Conduta:");
  });
});

describe("HW-6A.I4A — ClinicalCaseModal source purity", () => {
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
