/**
 * K9 Ops Web — Health Web v1 HW-6A.I4B
 * VISÃO CLÍNICA DO K9 — truthfulness and boundaries of the second interaction.
 *
 * What this file is really defending is not the layout, it is the two ways a
 * K9-anchored clinical view can lie:
 *
 * 1. BY INFERENCE. Per-case tri-states can legitimately disagree across a K9's
 *    cases (`true` on one, `null` on another). Any component that collapses them
 *    into "este K9 tem restrição" has invented a fact no document states. So the
 *    tests below assert that the signals block reports COUNTS OVER CASES, that all
 *    three buckets stay separate, and that no K9-level verdict wording appears.
 * 2. BY SCOPE CREEP. A K9 view is exactly where readiness, nutrition and agenda
 *    would feel natural — and each of them is a different read contract (§8/§11).
 *    So the tests assert those are ABSENT, that the dialog offers no drill-in, and
 *    that the presentation source contains no data-access token.
 *
 * Plus the two rules this vertical repeats everywhere: `openedAt` is never
 * promoted into "Última atividade", and an unrecognized status stays visible.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import type { ClinicalCaseReadModel } from "../types";
import {
  ClinicalK9Modal,
  deriveClinicalK9Context,
  tallyClinicalFlag,
} from "../presentation/clinical-k9-modal";

function caseModel(
  caseId: string,
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseReadModel {
  return {
    dogId: "k9-luna",
    caseId,
    clinicalStatus: "open",
    rawClinicalStatus: "open",
    title: `Caso ${caseId}`,
    openedAt: new Date("2026-02-01T12:00:00Z"),
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

function entry(
  caseId: string,
  overrides: Partial<ClinicalCaseReadModel> = {},
  dog: Partial<ClinicalCaseListEntry["dog"]> = {},
): ClinicalCaseListEntry {
  const item = caseModel(caseId, overrides);
  return {
    entryId: `${item.dogId}:${caseId}`,
    dogId: item.dogId,
    caseId,
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

/** Renders the modal over a real derived context, the way the view does. */
function renderModal(
  entries: ClinicalCaseListEntry[],
  dogId = "k9-luna",
) {
  const onClose = vi.fn();
  const context = deriveClinicalK9Context(dogId, entries);
  const utils = render(<ClinicalK9Modal context={context} onClose={onClose} />);
  return { onClose, context, ...utils };
}

describe("HW-6A.I4B — deriveClinicalK9Context", () => {
  // 1 — §16 a closed view derives nothing
  it("1. a null dogId yields no context", () => {
    expect(deriveClinicalK9Context(null, [entry("c1")])).toBeNull();
  });

  // 2 — §17 a K9 absent from the authorized dataset yields no context.
  // This is the mechanism that stops the view outliving its own authority: an
  // emptied, forbidden or refreshed-away scope produces null, and the dialog
  // unmounts rather than holding stale clinical data.
  it("2. a dogId absent from the entries yields no context", () => {
    expect(deriveClinicalK9Context("k9-thor", [entry("c1")])).toBeNull();
    expect(deriveClinicalK9Context("k9-luna", [])).toBeNull();
  });

  // 3 — §10 the context collects EVERY case of that K9, and only that K9's
  it("3. the context collects exactly that K9's cases", () => {
    const entries = [
      entry("c1"),
      entry("c2", { dogId: "k9-thor" }, { name: "Thor" }),
      entry("c3"),
    ];
    const context = deriveClinicalK9Context("k9-luna", entries);

    expect(context).not.toBeNull();
    expect(context?.dogId).toBe("k9-luna");
    expect(context?.entries.map((e) => e.caseId)).toEqual(["c1", "c3"]);
    // Identity comes from the loaded read, not from a separate source.
    expect(context?.dog.name).toBe("Luna");
  });

  // 4 — order is preserved: the K9 view never re-sorts the composed order
  it("4. the incoming composition order is preserved", () => {
    const entries = [entry("c9"), entry("c1"), entry("c5")];
    expect(
      deriveClinicalK9Context("k9-luna", entries)?.entries.map((e) => e.caseId),
    ).toEqual(["c9", "c1", "c5"]);
  });
});

describe("HW-6A.I4B — tallyClinicalFlag", () => {
  // 1 — §12 the three tri-state outcomes are counted SEPARATELY
  it("1. true, false and null are counted into three distinct buckets", () => {
    const entries = [
      entry("c1", { hasActiveRestriction: true }),
      entry("c2", { hasActiveRestriction: false }),
      entry("c3", { hasActiveRestriction: null }),
      entry("c4", { hasActiveRestriction: true }),
    ];

    expect(
      tallyClinicalFlag(entries, (e) => e.case.hasActiveRestriction),
    ).toEqual({ affirmed: 2, negated: 1, unknown: 1 });
  });

  // 2 — an absent flag is NEVER folded into the negative bucket
  it("2. an all-null flag counts as unknown, never as negated", () => {
    const entries = [entry("c1"), entry("c2")];
    expect(tallyClinicalFlag(entries, (e) => e.case.hasPendingSchedule)).toEqual({
      affirmed: 0,
      negated: 0,
      unknown: 2,
    });
  });

  // 3 — empty input is an honest all-zero, not a fabricated outcome
  it("3. no cases yields all zeros", () => {
    expect(tallyClinicalFlag([], (e) => e.case.hasActiveRestriction)).toEqual({
      affirmed: 0,
      negated: 0,
      unknown: 0,
    });
  });
});

describe("HW-6A.I4B — ClinicalK9Modal", () => {
  // 1 — §16 no context, no dialog
  it("1. a null context renders nothing at all", () => {
    const { container } = render(
      <ClinicalK9Modal context={null} onClose={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 2 — §28 dialog semantics come from the shared primitive, unmodified
  it("2. it renders an accessible modal dialog", () => {
    renderModal([entry("c1")]);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Visão clínica do K9");
    expect(screen.getByTestId("clinical-k9-modal")).toBeInTheDocument();
  });

  // 3 — §28 the close control works and is the ONLY control
  it("3. the close control is the only control in the dialog", () => {
    const { onClose } = renderModal([entry("c1"), entry("c2")]);
    const dialog = screen.getByRole("dialog");
    const buttons = [...dialog.querySelectorAll("button")];

    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "Fechar");
    // No drill-in, no navigation, no write affordance.
    expect(dialog.querySelector("a")).toBeNull();
    expect(dialog.querySelector("[href]")).toBeNull();
    expect(dialog.querySelector("input")).toBeNull();
    expect(dialog.querySelector("select")).toBeNull();

    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 4 — §28 Escape closes it
  it("4. Escape requests close", () => {
    const { onClose } = renderModal([entry("c1")]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 5 — §13 identity: name, MAT, photo from dog.photoUrl only
  it("5. the K9 identity renders name, MAT and the institutional photo", () => {
    const url = "https://institutional.example/k9/luna.jpg";
    renderModal([entry("c1", {}, { photoUrl: url })]);

    expect(screen.getByTestId("clinical-k9-modal-name")).toHaveTextContent("Luna");
    expect(screen.getByTestId("clinical-k9-modal-registration")).toHaveTextContent(
      "MAT. K9-2202",
    );
    const photo = screen.getByTestId("clinical-k9-modal-photo");
    expect(photo.tagName).toBe("IMG");
    expect(photo).toHaveAttribute("src", url);
  });

  // 6 — §13 a missing photo is a labelled fallback, never a fake photograph
  it("6. a missing photo renders a labelled fallback", () => {
    renderModal([entry("c1", {}, { photoUrl: null })]);
    const fallback = screen.getByTestId("clinical-k9-modal-photo-fallback");

    expect(fallback).toHaveAttribute("role", "img");
    expect(fallback).toHaveAttribute(
      "aria-label",
      "K9 Luna sem foto cadastrada",
    );
    expect(fallback.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("clinical-k9-modal-photo")).not.toBeInTheDocument();
  });

  // 7 — MAT is never fabricated from an id
  it("7. a missing MAT stays truthful and never derives from an id", () => {
    renderModal([entry("c1", {}, { registrationNumber: null })]);
    const mat = screen.getByTestId("clinical-k9-modal-registration");

    expect(mat).toHaveTextContent("MAT. não informada");
    expect(mat).not.toHaveTextContent("k9-luna");
  });

  // 8 — §7 this is NOT the Efetivo K9 profile.
  //
  // Breed, sex, birth date, conductor and specialties ARE present on the loaded
  // identity, so leaving them out is a decision, not an accident — and it is the
  // decision that keeps a clinical view from becoming a profile view.
  it("8. it renders no K9 profile field even though the data is loaded", () => {
    const { container } = renderModal([
      entry(
        "c1",
        {},
        {
          breed: "Pastor Alemão",
          sex: "female",
          dateOfBirth: new Date("2021-05-01T12:00:00Z"),
          conductor: { ra: "990010", name: "Sgt. Silva" },
          specialties: [{ id: "s1", type: "Patrulha", status: "active" }],
        },
      ),
    ]);
    const text = container.textContent ?? "";

    for (const profileField of [
      "Pastor Alemão",
      "Sgt. Silva",
      "Patrulha",
      "Raça",
      "Sexo",
      "Nascimento",
      "Condutor",
      "Especialidade",
    ]) {
      expect(text).not.toContain(profileField);
    }
    // And no route out of the dialog.
    expect(container.querySelector("a")).toBeNull();
    expect(text).not.toContain("Ver perfil");
  });

  // 9 — §10 case counts are membership counts, matching the list's own buckets
  it("9. the scope counts report total, active and closed cases", () => {
    renderModal([
      entry("c1", { clinicalStatus: "under_treatment" }),
      entry("c2", { clinicalStatus: "monitoring" }),
      entry("c3", { clinicalStatus: "discharged" }),
    ]);

    expect(screen.getByTestId("clinical-k9-count-total")).toHaveTextContent("3");
    expect(screen.getByTestId("clinical-k9-count-active")).toHaveTextContent("2");
    expect(screen.getByTestId("clinical-k9-count-closed")).toHaveTextContent("1");
    // A clean parse advertises no permanent "0 não reconhecidos".
    expect(
      screen.queryByTestId("clinical-k9-count-unrecognized"),
    ).not.toBeInTheDocument();
  });

  // 10 — §12/§13 an unrecognized case is counted AND listed, never hidden
  it("10. an unrecognized case is counted and stays visible in its own group", () => {
    renderModal([
      entry("c1", { clinicalStatus: "open" }),
      entry("c2", { clinicalStatus: null, rawClinicalStatus: "quarantine" }),
    ]);

    expect(screen.getByTestId("clinical-k9-count-unrecognized")).toHaveTextContent(
      "1",
    );
    const group = screen.getByTestId("clinical-k9-modal-group-unrecognized");
    expect(group).toBeInTheDocument();
    expect(within(group).getAllByTestId("clinical-k9-case-line")).toHaveLength(1);
    // The raw value is not promoted into a canonical stage.
    expect(group).toHaveTextContent("Status não reconhecido");
  });

  // 11 — THE inference rule: counts over CASES, never a verdict about the K9
  it("11. the signals block reports per-case counts, not a K9-level verdict", () => {
    const { container } = renderModal([
      entry("c1", { hasActiveRestriction: true }),
      entry("c2", { hasActiveRestriction: null }),
    ]);

    const row = screen.getByTestId("clinical-k9-tally-restriction");
    expect(row).toHaveTextContent("1 com restrição");
    expect(row).toHaveTextContent("0 sem restrição");
    expect(row).toHaveTextContent("1 não informado");
    // The label is about CASES.
    expect(row).toHaveTextContent("Casos com restrição clínica ativa");
    // And the block says so explicitly.
    expect(container.textContent).toContain(
      "Nenhuma conclusão sobre o K9 é derivada destes números",
    );
    // No K9-level claim anywhere.
    expect(container.textContent).not.toContain("K9 com restrição");
    expect(container.textContent).not.toContain("K9 restrito");
  });

  // 12 — a disagreeing pair never collapses into a single answer
  it("12. cases that disagree keep all three counts visible", () => {
    renderModal([
      entry("c1", { hasPendingSchedule: true }),
      entry("c2", { hasPendingSchedule: false }),
      entry("c3", { hasPendingSchedule: null }),
    ]);

    const row = screen.getByTestId("clinical-k9-tally-schedule");
    expect(row).toHaveTextContent("1 pendente");
    expect(row).toHaveTextContent("1 sem pendência");
    expect(row).toHaveTextContent("1 não informado");
  });

  // 13 — §12 zero treatments and unknown treatments are DIFFERENT facts.
  //
  // `activeTreatmentsCount` is a count, so `0` is an affirmed "nenhum" while
  // `null` is "not informed". Both would read as zero if the tally were naive.
  it("13. a zero treatment count is negated, an absent one is unknown", () => {
    renderModal([
      entry("c1", { activeTreatmentsCount: 0 }),
      entry("c2", { activeTreatmentsCount: null }),
      entry("c3", { activeTreatmentsCount: 2 }),
    ]);

    const row = screen.getByTestId("clinical-k9-tally-treatment");
    expect(row).toHaveTextContent("1 com tratamento");
    expect(row).toHaveTextContent("1 sem tratamento");
    expect(row).toHaveTextContent("1 não informado");
  });

  // 14 — THE last-activity rule, restated inside the K9 view
  it("14. openedAt is never promoted into the Última atividade slot", () => {
    const openedAt = new Date("2026-03-10T12:00:00Z");
    renderModal([entry("c1", { openedAt, lastEventAt: null })]);

    const slot = screen.getByTestId("clinical-k9-case-last-activity");
    expect(slot).toHaveTextContent("Sem atividade posterior");
    expect(slot).not.toHaveTextContent(openedAt.toLocaleDateString("pt-BR"));
  });

  // 15 — a real lastEventAt renders as its own date
  it("15. a present lastEventAt renders as its own date", () => {
    const lastEventAt = new Date("2026-04-02T12:00:00Z");
    renderModal([entry("c1", { lastEventAt })]);

    expect(screen.getByTestId("clinical-k9-case-last-activity")).toHaveTextContent(
      lastEventAt.toLocaleDateString("pt-BR"),
    );
  });

  // 16 — an absent title is labelled, not blank, and not derived from the caseId
  it("16. an absent case title renders the explicit absence label", () => {
    renderModal([entry("c1", { title: null })]);
    const title = screen.getByTestId("clinical-k9-case-title");

    expect(title).toHaveTextContent("Sem título informado");
    expect(title).not.toHaveTextContent("c1");
    expect(title.className).toContain("italic");
  });

  // 17 — §8/§11 the cross-vertical fields are ABSENT, and said to be absent.
  //
  // The scope note is what stops a bounded view from reading as a richer screen
  // that failed to load.
  it("17. no readiness, nutrition or agenda content is fabricated", () => {
    const { container } = renderModal([
      entry("c1", { clinicalStatus: "under_treatment", hasPendingSchedule: true }),
    ]);
    const text = container.textContent ?? "";

    for (const invented of [
      "Prontidão do K9",
      "Score",
      "Índice",
      "Plano nutricional",
      "Ração",
      "Próximo evento",
      "Próxima ação",
      "Diagnóstico",
      "Prognóstico",
      "Severidade",
      "Gravidade",
      "Risco",
    ]) {
      expect(text).not.toContain(invented);
    }

    // The scope statement names what is not here.
    const note = screen.getByTestId("clinical-k9-modal-scope-note");
    expect(note).toHaveTextContent("Prontidão");
    expect(note).toHaveTextContent("nutrição");
    expect(note).toHaveTextContent("agenda");
    expect(note).toHaveTextContent("não fazem parte desta visualização");
  });

  // 18 — §16 the case lines are informational: the K9 view opens nothing
  it("18. the case lines are not interactive", () => {
    renderModal([entry("c1"), entry("c2")]);
    const lines = screen.getAllByTestId("clinical-k9-case-line");

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.tagName).toBe("LI");
      expect(line.querySelector("button")).toBeNull();
      expect(line).not.toHaveAttribute("tabindex");
      expect(line).not.toHaveAttribute("role", "button");
      expect(line.closest("button")).toBeNull();
    }
  });

  // 19 — every case of the K9 is listed; none is silently dropped
  it("19. every case in the context appears exactly once", () => {
    renderModal([
      entry("c1", { clinicalStatus: "open" }),
      entry("c2", { clinicalStatus: "discharged" }),
      entry("c3", { clinicalStatus: null }),
    ]);

    const ids = screen
      .getAllByTestId("clinical-k9-case-line")
      .map((line) => line.getAttribute("data-entry-id"));

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const caseId of ["c1", "c2", "c3"]) {
      expect(ids).toContain(`k9-luna:${caseId}`);
    }
  });

  // 20 — §21 the K9 view performs no data access of its own.
  //
  // Asserted against the SOURCE, because a runtime assertion could only prove
  // that no read happened on this render path — not that none was written.
  it("20. the K9 modal source contains no data-access token", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../presentation/clinical-k9-modal.tsx"),
      "utf8",
    );

    for (const token of [
      "firebase/firestore",
      "firebase/functions",
      "@/lib/firebase/client",
      "loadClinicalScope",
      "readClinicalCasesForDog",
      "getDocs",
      "collection(",
      "httpsCallable",
      "useEffect",
      "fetch(",
    ]) {
      expect(source, `must not reference ${token}`).not.toContain(token);
    }
  });
});
