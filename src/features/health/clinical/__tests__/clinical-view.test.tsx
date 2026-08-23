/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * ClinicalView — the seven truthful technical screens, KPI derivation,
 * in-memory filtering, and the static "no data-access in presentation" guard.
 *
 * The mandatory distinctions:
 *   forbidden !== empty,  error !== empty,  partial !== success,
 *   filter-empty !== global-empty.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadState } from "../../domain/read-states";
import type {
  ClinicalCaseListEntry,
  ClinicalScopeCoverage,
} from "../data/clinical-scope-loader";
import type { ClinicalCaseReadModel } from "../types";
import type { UseClinicalCasesResult } from "../hooks/use-clinical-cases";

// The view must consume the hook and NOTHING firebase-shaped. The hook itself
// is stubbed so state transitions are what is under test.
const hookMock = vi.hoisted(() => ({ current: null as UseClinicalCasesResult | null }));
vi.mock("../hooks/use-clinical-cases", () => ({
  useClinicalCases: () => hookMock.current,
}));

import { ClinicalView } from "../presentation/clinical-view";

function coverage(
  overrides: Partial<ClinicalScopeCoverage> = {},
): ClinicalScopeCoverage {
  return {
    dogsInScope: 1,
    authorizedDogIds: ["k9-a"],
    forbiddenDogIds: [],
    failedDogIds: [],
    partialEntryIds: [],
    complete: true,
    ...overrides,
  };
}

function caseModel(
  caseId: string,
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseReadModel {
  return {
    dogId: "k9-a",
    caseId,
    clinicalStatus: "open",
    rawClinicalStatus: "open",
    title: `Caso ${caseId}`,
    openedAt: new Date("2026-02-01T00:00:00Z"),
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
      name: "Apollo",
      registrationNumber: null,
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

function setHook(
  state: ReadState<ClinicalCaseListEntry[]>,
  overrides: Partial<UseClinicalCasesResult> = {},
) {
  hookMock.current = {
    state,
    coverage: coverage(),
    authorityStatus: "allowed",
    refresh: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  hookMock.current = null;
});

describe("HW-6A.I3 — ClinicalView technical states", () => {
  // 1
  it("1. loading renders a skeleton and no real count or status", () => {
    setHook({ status: "loading" }, { authorityStatus: "loading" });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-summary-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-list")).not.toBeInTheDocument();
  });

  // 2 — forbidden !== empty
  it("2. forbidden renders the denial screen, never an empty list", () => {
    setHook(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Leitura não autorizada.",
      },
      { authorityStatus: "forbidden" },
    );
    render(<ClinicalView />);

    const forbidden = screen.getByTestId("clinical-forbidden");
    expect(forbidden).toBeInTheDocument();
    // RF §18/§28: the denial names the permission in HUMAN terms. The raw
    // capability token stays in state and is never printed in the UI.
    expect(forbidden).toHaveTextContent("Permissão necessária");
    expect(forbidden).toHaveTextContent("Leitura de Saúde");
    expect(forbidden).not.toHaveTextContent("health.read");
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-list")).not.toBeInTheDocument();
  });

  // 2b — RF forbidden copy is user-facing, and the denial stays a denial
  it("2b. the forbidden screen never leaks a developer capability token", () => {
    setHook(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Leitura não autorizada.",
      },
      { authorityStatus: "forbidden" },
    );
    const { container } = render(<ClinicalView />);

    // Nowhere in the rendered denial screen, not just inside the card.
    expect(container.textContent).not.toContain("health.read");
    expect(container.textContent).not.toContain("Capacidade requerida");
    // RF2 §8: the de-duplicated institutional denial wording.
    expect(screen.getByTestId("clinical-forbidden")).toHaveTextContent(
      "Acesso clínico não autorizado",
    );
    expect(screen.getByTestId("clinical-forbidden")).toHaveTextContent(
      "Seu perfil atual não possui permissão para consultar os registros clínicos.",
    );
  });

  /*
   * RF2 §8/§16 — the denial must be stated ONCE.
   *
   * V2 rendered four stacked sentences, two of which restated each other
   * ("Leitura de casos clínicos não autorizada." plus "...não autorizada para o
   * perfil de acesso atual."). These tests pin the de-duplicated structure and,
   * crucially, that a denial is still a denial.
   */
  it("2c. the forbidden screen states the denial exactly once", () => {
    setHook(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        // A generic restatement: it must NOT be echoed into the card.
        message:
          "Leitura de casos clínicos não autorizada para o perfil de acesso atual.",
      },
      { authorityStatus: "forbidden" },
    );
    render(<ClinicalView />);

    const text = screen.getByTestId("clinical-forbidden").textContent ?? "";

    // The duplicated V2 sentences are gone.
    expect(text).not.toContain(
      "Leitura de casos clínicos não autorizada para o perfil de acesso atual.",
    );
    expect(text).not.toContain("Leitura de casos clínicos não autorizada.");

    // Exactly one "não autorizado/a" statement remains (the title).
    const denialMentions = text.match(/não autoriz/gi) ?? [];
    expect(denialMentions).toHaveLength(1);

    // And the three approved semantic parts are all present.
    expect(text).toContain("Acesso clínico não autorizado");
    expect(text).toContain(
      "Seu perfil atual não possui permissão para consultar os registros clínicos.",
    );
    expect(text).toContain("Permissão necessária");
    expect(text).toContain("Leitura de Saúde");
  });

  it("2d. de-duplicating the copy did not turn the denial into emptiness", () => {
    setHook(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Leitura não autorizada.",
      },
      { authorityStatus: "forbidden" },
    );
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-forbidden")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-summary-cards")).not.toBeInTheDocument();
    // No reassuring zero anywhere on a denial screen.
    expect(screen.getByTestId("clinical-forbidden").textContent).not.toMatch(/\b0\b/);
  });

  // 3 — error !== empty
  it("3. error renders the failure screen, never an empty list", () => {
    setHook({
      status: "error",
      code: "CLINICAL_SCOPE_READ_ERROR",
      message: "boom",
      retryable: true,
    });
    render(<ClinicalView />);

    const err = screen.getByTestId("clinical-error");
    expect(err).toBeInTheDocument();
    expect(err).toHaveTextContent("CLINICAL_SCOPE_READ_ERROR");
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
  });

  // 4 — global empty
  it("4. empty renders the proven-zero scope state with KPIs, not a failure", () => {
    setHook({ status: "empty", query: "dogs/*/clinical_cases" });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-scope-empty")).toBeInTheDocument();
    // KPIs still render (all zero) — an empty scope is an answer, not a crash.
    expect(screen.getByTestId("clinical-summary-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-forbidden")).not.toBeInTheDocument();
  });

  // 5 — success
  it("5. success renders the list and derives KPIs", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { clinicalStatus: "under_investigation" }),
        entry("c2", { clinicalStatus: "discharged" }),
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-case-list")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-group-active")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-group-closed")).toBeInTheDocument();
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(2);
  });

  // 6 — partial !== success
  it("6. partial shows the coverage notice AND the trustworthy cases", () => {
    setHook(
      {
        status: "partial",
        partialData: [entry("c1")],
        failedSources: ["forbidden:dogs/k9-b/clinical_cases"],
        successfulSources: ["dogs/k9-a/clinical_cases"],
      },
      {
        coverage: coverage({
          dogsInScope: 2,
          forbiddenDogIds: ["k9-b"],
          complete: false,
        }),
      },
    );
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-partial-notice")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-partial-notice")).toHaveTextContent(
      /1 K9 não autorizado/,
    );
    expect(screen.getByTestId("clinical-case-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
  });

  // 7 — refreshing keeps previous list visible
  it("7. refreshing keeps the previous list visible with a transient notice", () => {
    setHook({ status: "refreshing", previousData: [entry("c1")] });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-refreshing")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-case-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
  });
});

/**
 * HW-6A.I3.F1 — refreshing previousData type contract.
 *
 * The shared `ReadStateRefreshing` types `previousData` as `unknown`. The
 * Clinical view narrows it with a local runtime guard. These tests pin BOTH
 * halves of that contract: the proven producer shape still renders exactly as
 * V1 homologated it, and a violated contract degrades to "still working" rather
 * than to a FALSE EMPTY LIST.
 */
describe("HW-6A.I3.F1 — refreshing previousData contract", () => {
  // 1 — frozen behaviour: multiple rows survive a refresh unchanged
  it("1. a well-formed previousData renders every previous row", () => {
    setHook({
      status: "refreshing",
      previousData: [entry("c1"), entry("c2"), entry("c3")],
    });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-refreshing")).toBeInTheDocument();
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(3);
    // Never a false empty while a refresh is in flight.
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
  });

  // 2 — KPIs stay derived from the preserved list, not zeroed
  it("2. KPIs are still derived from the preserved list during a refresh", () => {
    setHook({
      status: "refreshing",
      previousData: [
        entry("c1", { clinicalStatus: "open" }),
        entry("c2", { clinicalStatus: "monitoring" }),
      ],
    });
    render(<ClinicalView />);

    const kpi = screen.getByTestId("clinical-kpi-monitored");
    expect(within(kpi).getByText("2")).toBeInTheDocument();
  });

  // 3 — filters remain applicable over the preserved list
  it("3. filtering still works over the preserved list during a refresh", () => {
    setHook({
      status: "refreshing",
      previousData: [
        entry("c1", { title: "Otite externa" }),
        entry("c2", { title: "Claudicação" }),
      ],
    });
    render(<ClinicalView />);

    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "otite" },
    });
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
    // The transient notice is not lost by filtering.
    expect(screen.getByTestId("clinical-refreshing")).toBeInTheDocument();
  });

  // 4 — an empty previous list is still a legitimate refresh, not a violation
  it("4. an empty array is a valid previousData and does not degrade", () => {
    setHook({ status: "refreshing", previousData: [] });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-refreshing")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-skeleton")).not.toBeInTheDocument();
  });

  // 5 — THE degradation rule: a violated contract must NOT become a proven zero
  it("5. a malformed previousData degrades to the skeleton, never a false empty", () => {
    // Deliberately violates the producer invariant. `previousData` is `unknown`
    // in the shared contract, so this is representable without any cast.
    setHook({ status: "refreshing", previousData: { not: "an array" } });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-skeleton")).toBeInTheDocument();
    // Crucially: no empty state and no case list were presumed.
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-list")).not.toBeInTheDocument();
  });

  // 6
  it("6. an array of non-entry values also degrades instead of rendering rows", () => {
    setHook({ status: "refreshing", previousData: [1, 2, 3] });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-card")).not.toBeInTheDocument();
  });

  // 7
  it("7. a null previousData degrades to the skeleton", () => {
    setHook({ status: "refreshing", previousData: null });
    render(<ClinicalView />);

    expect(screen.getByTestId("clinical-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
  });
});

describe("HW-6A.I3 — ClinicalView KPIs", () => {
  // 8
  it("8. 'Casos em acompanhamento' counts only the four active statuses", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { clinicalStatus: "open" }),
        entry("c2", { clinicalStatus: "monitoring" }),
        entry("c3", { clinicalStatus: "discharged" }), // excluded
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    const kpi = screen.getByTestId("clinical-kpi-monitored");
    expect(within(kpi).getByText("2")).toBeInTheDocument();
  });

  // 9 — null !== 0 in the treatments sum
  it("9. treatments KPI sums known counts and flags cases with an unknown count", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { activeTreatmentsCount: 2 }),
        entry("c2", { activeTreatmentsCount: null }),
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    const kpi = screen.getByTestId("clinical-kpi-treatments");
    expect(within(kpi).getByText("2")).toBeInTheDocument();
    // A partial sum is disclosed as partial, never presented as complete.
    expect(screen.getByTestId("clinical-kpi-treatments-incomplete")).toHaveTextContent(
      /Soma parcial/,
    );
  });

  // 10 — null !== false in the restriction KPI
  it("10. restriction KPI counts only affirmed true and discloses unknowns", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { hasActiveRestriction: true }),
        entry("c2", { hasActiveRestriction: false }),
        entry("c3", { hasActiveRestriction: null }),
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    const kpi = screen.getByTestId("clinical-kpi-restriction");
    expect(within(kpi).getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-kpi-restriction-incomplete")).toHaveTextContent(
      /sem informação de restrição/,
    );
  });
});

describe("HW-6A.I3 — ClinicalView filtering", () => {
  // 11
  it("11. status filter narrows the visible rows", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { clinicalStatus: "open", title: "Aberto A" }),
        entry("c2", { clinicalStatus: "discharged", title: "Encerrado B" }),
      ],
      fetchedAt: new Date(),
    });
    const { container } = render(<ClinicalView />);

    fireEvent.change(screen.getByLabelText("Status:"), {
      target: { value: "discharged" },
    });

    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
    expect(container).toHaveTextContent("Encerrado B");
    expect(container).not.toHaveTextContent("Aberto A");
  });

  // 12 — filter-empty !== global-empty
  it("12. a filter that matches nothing shows filter-empty, not scope-empty", () => {
    setHook({
      status: "success",
      data: [entry("c1", { title: "Claudicação" })],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "zzz-nao-existe" },
    });

    expect(screen.getByTestId("clinical-filter-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
  });

  // 13 — unavailable filter targets null specifically
  it("13. restriction 'Indisponível' matches only cases whose flag is null", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { title: "Com flag", hasActiveRestriction: false }),
        entry("c2", { title: "Sem flag", hasActiveRestriction: null }),
      ],
      fetchedAt: new Date(),
    });
    const { container } = render(<ClinicalView />);

    fireEvent.change(screen.getByLabelText("Restrição:"), {
      target: { value: "unavailable" },
    });

    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
    expect(container).toHaveTextContent("Sem flag");
    expect(container).not.toHaveTextContent("Com flag");
  });
});

describe("HW-6A.I3 — ClinicalView static source guarantee", () => {
  // 14 — presentation performs NO data access
  it("14. no presentation file imports firebase or the firebase client", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../presentation");
    const files = await fs.readdir(dir);

    for (const file of files) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      const source = await fs.readFile(path.join(dir, file), "utf8");
      expect(source, `${file} must not import firebase/firestore`).not.toContain(
        "firebase/firestore",
      );
      expect(source, `${file} must not import firebase/functions`).not.toContain(
        "firebase/functions",
      );
      expect(source, `${file} must not import the firebase client`).not.toContain(
        "@/lib/firebase/client",
      );
      // And no direct call into the scope loader: the hook is the only path.
      expect(source, `${file} must not call loadClinicalScope directly`).not.toContain(
        "loadClinicalScope",
      );

      /*
       * I4A §31 — extended to the full forbidden-token list, which now also
       * covers the new card and modal files (this loop reads the whole
       * presentation directory, so they are included automatically).
       *
       * The modal is the reason this matters: a case-detail dialog is exactly
       * where a "just fetch the events too" read would be tempting to add.
       */
      for (const token of [
        "getDocs",
        "collection(",
        "httpsCallable",
        "readClinicalCasesForDog",
      ]) {
        expect(source, `${file} must not reference ${token}`).not.toContain(token);
      }
    }
  });

  // 14b — I4A §31 / I4B §21: the card and BOTH modal files are really in the
  // guard's scope. The K9 view is the newest and most tempting place to add a
  // "while we are here, fetch readiness/nutrition/agenda too" read, so its
  // presence in the guarded directory is asserted explicitly rather than assumed.
  it("14b. the card and both modal files are covered by the static guard", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../presentation");
    const files = await fs.readdir(dir);

    expect(files).toContain("clinical-case-card.tsx"); // hosts ClinicalCaseCard
    expect(files).toContain("clinical-case-modal.tsx");
    expect(files).toContain("clinical-k9-modal.tsx"); // I4B — VISÃO CLÍNICA DO K9
  });
});

/**
 * HW-6A.V1.RF4 §19/§26 — KPI typography scale.
 *
 * The KPI cards have no dedicated test file: `ClinicalSummaryCards` only renders
 * through `ClinicalView`, so §4's conditional authorization for this file applies.
 *
 * STRUCTURAL typography assertions only, plus re-assertions that the FROZEN KPI
 * contract (exactly four instruments, their semantics, their copy and their
 * incompleteness disclosures) survived a purely visual change.
 */
describe("HW-6A.V1.RF4 — KPI typography scale", () => {
  function renderKpis() {
    setHook({
      status: "success",
      data: [
        entry("c1", { clinicalStatus: "open", activeTreatmentsCount: 2 }),
        entry("c2", { clinicalStatus: "under_investigation", hasActiveRestriction: true }),
      ],
      fetchedAt: new Date(),
    });
    return render(<ClinicalView />);
  }

  // 1 — FROZEN: exactly four instruments, no more, no fewer
  it("1. exactly the four canonical KPIs are rendered", () => {
    renderKpis();
    const cards = screen.getByTestId("clinical-summary-cards");

    expect(cards.children).toHaveLength(4);
    for (const key of ["monitored", "investigation", "treatments", "restriction"]) {
      expect(screen.getByTestId(`clinical-kpi-${key}`)).toBeInTheDocument();
    }
  });

  // 2 — FROZEN: KPI copy is not a visual concern
  it("2. every KPI label and supporting hint is unchanged", () => {
    renderKpis();

    expect(screen.getByText("Casos em acompanhamento")).toBeInTheDocument();
    expect(
      screen.getByText("aberto, investigação, tratamento ou monitoramento"),
    ).toBeInTheDocument();
    expect(screen.getByText("Em investigação")).toBeInTheDocument();
    expect(screen.getByText("status canônico em investigação")).toBeInTheDocument();
    // "Tratamentos ativos" is ALSO a row metadata label, so scope to the card.
    expect(
      within(screen.getByTestId("clinical-kpi-treatments")).getByText(
        "Tratamentos ativos",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("soma dos totais informados por caso")).toBeInTheDocument();
    expect(screen.getByText("Com restrição ativa")).toBeInTheDocument();
    expect(screen.getByText("restrição ativa afirmada no caso")).toBeInTheDocument();
  });

  // 3 — §19 the KPI title is readable, not a 12px caption
  it("3. the KPI title reaches 15px", () => {
    renderKpis();
    const label = screen.getByText("Casos em acompanhamento");

    expect(label.className).toMatch(/text-\[15px\]/);
    expect(label.className).not.toMatch(/\btext-xs\b/);
  });

  // 4 — §19 the supporting text stops being an 11px footnote
  it("4. the KPI supporting hint reaches 13px", () => {
    renderKpis();
    const hint = screen.getByText("aberto, investigação, tratamento ou monitoramento");

    expect(hint.className).toMatch(/text-\[13px\]/);
    expect(hint.className).not.toMatch(/text-\[11px\]/);
  });

  // 5 — §19 the numeric value stays visually strong
  it("5. the KPI numeric value remains strong and tabular", () => {
    renderKpis();
    const kpi = screen.getByTestId("clinical-kpi-monitored");
    const value = within(kpi).getByText("2");

    expect(value.className).toMatch(/text-\[28px\]/);
    expect(value.className).toMatch(/\bfont-black\b/);
    expect(value.className).toMatch(/\btabular-nums\b/);
  });

  // 6 — §19 the coverage qualifier must be readable, it is a truthfulness device
  it("6. the incompleteness qualifier reaches 13px", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { activeTreatmentsCount: 2 }),
        entry("c2", { activeTreatmentsCount: null }),
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    const note = screen.getByTestId("clinical-kpi-treatments-incomplete");
    expect(note).toHaveTextContent(/Soma parcial/);
    expect(note.className).toMatch(/text-\[13px\]/);
    expect(note.className).not.toMatch(/text-\[11px\]/);
  });

  // 7 — FROZEN: semantics. null is still neither 0 nor false after the rescale.
  it("7. KPI semantics survive the visual scale change", () => {
    setHook({
      status: "success",
      data: [
        entry("c1", { clinicalStatus: "open", hasActiveRestriction: true }),
        entry("c2", { clinicalStatus: "discharged", hasActiveRestriction: false }),
        entry("c3", { clinicalStatus: "monitoring", hasActiveRestriction: null }),
      ],
      fetchedAt: new Date(),
    });
    render(<ClinicalView />);

    // discharged is excluded from "em acompanhamento".
    expect(
      within(screen.getByTestId("clinical-kpi-monitored")).getByText("2"),
    ).toBeInTheDocument();
    // Only affirmed true is counted; null is disclosed, never counted as false.
    expect(
      within(screen.getByTestId("clinical-kpi-restriction")).getByText("1"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("clinical-kpi-restriction-incomplete"),
    ).toHaveTextContent(/sem informação de restrição/);
  });

  // 8 — FROZEN: the cards remain instruments, not controls
  it("8. the rescaled KPI cards are still non-interactive", () => {
    renderKpis();
    const cards = screen.getByTestId("clinical-summary-cards");

    expect(cards.querySelector("button")).toBeNull();
    expect(cards.querySelector("a")).toBeNull();
    expect(cards.querySelector("[tabindex]")).toBeNull();
    for (const card of [...cards.children] as HTMLElement[]) {
      expect(card).toHaveAttribute("role", "group");
      expect(card.className).not.toContain("cursor-pointer");
    }
  });
});

/**
 * HW-6A.I4A §26/§30/§31 — card -> modal integration at view level.
 *
 * The card and the modal are unit-tested separately; what only the view can prove
 * is that they are WIRED, that the modal shows the case that was actually clicked,
 * and that opening it costs no additional read. The hook is mocked here, so "no
 * extra read" is provable: if the modal needed data the card did not have, it
 * would have to call something, and the mock would record it.
 */
describe("HW-6A.I4A — card to modal integration", () => {
  function renderCases() {
    setHook({
      status: "success",
      data: [
        entry("c1", { title: "Otite externa", clinicalStatus: "under_treatment" }, { name: "Luna" }),
        entry("c2", { title: "Claudicação", clinicalStatus: "open" }, { name: "Thor" }),
      ],
      fetchedAt: new Date(),
    });
    return render(<ClinicalView />);
  }

  function cardFor(name: string): HTMLElement {
    const card = screen
      .getAllByTestId("clinical-case-card")
      .find((c) =>
        c
          .querySelector('[data-testid="clinical-card-k9-name"]')
          ?.textContent?.includes(name),
      );
    if (!card) throw new Error(`no card for ${name}`);
    return card;
  }

  /** The CASE action inside the card for `name` — opens the case summary modal. */
  function caseActionFor(name: string): HTMLElement {
    const action = cardFor(name).querySelector(
      '[data-testid="clinical-case-action"]',
    ) as HTMLElement | null;
    if (!action) throw new Error(`no case action for ${name}`);
    return action;
  }

  // 1 — §26 the screen renders cards, and no modal until asked
  it("1. cases render as cards with no modal open initially", () => {
    renderCases();

    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();
  });

  // 2 — §30 click opens the modal
  it("2. clicking a card's case action opens the case summary modal", () => {
    renderCases();
    fireEvent.click(caseActionFor("Luna"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-case-modal")).toBeInTheDocument();
  });

  // 3 — §30 the modal shows the case that was clicked, not just the first one
  it("3. the modal shows the clicked case", () => {
    renderCases();
    fireEvent.click(caseActionFor("Thor"));

    expect(screen.getByTestId("clinical-modal-k9-name")).toHaveTextContent("Thor");
    expect(screen.getByTestId("clinical-modal-case-title")).toHaveTextContent(
      "Claudicação",
    );
    expect(screen.getByTestId("clinical-modal-k9-name")).not.toHaveTextContent(
      "Luna",
    );
  });

  // 4 — §30 opening ANOTHER card shows the correct case data
  it("4. opening a different card swaps to that case's data", () => {
    renderCases();

    fireEvent.click(caseActionFor("Luna"));
    expect(screen.getByTestId("clinical-modal-case-title")).toHaveTextContent(
      "Otite externa",
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(caseActionFor("Thor"));
    expect(screen.getByTestId("clinical-modal-case-title")).toHaveTextContent(
      "Claudicação",
    );
    expect(screen.getByTestId("clinical-modal-k9-name")).toHaveTextContent("Thor");
  });

  // 5 — §30 the close control closes it
  it("5. the close control dismisses the modal", () => {
    renderCases();
    fireEvent.click(caseActionFor("Luna"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 6 — §30 Escape closes it
  it("6. Escape dismisses the modal", () => {
    renderCases();
    fireEvent.click(caseActionFor("Luna"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 7 — §24 the open case's card reflects selection on its case action
  it("7. only the open case's case action is marked expanded", () => {
    renderCases();
    fireEvent.click(caseActionFor("Thor"));

    expect(caseActionFor("Thor")).toHaveAttribute("aria-expanded", "true");
    expect(caseActionFor("Luna")).toHaveAttribute("aria-expanded", "false");
  });

  // 8 — §8/§30 opening the modal triggers NO additional read.
  //
  // `refresh` is the only data-fetching capability the view is given; the modal
  // renders from the same composed entry as the card. If it needed anything else
  // it would have to ask for it, and this assertion would fail.
  it("8. opening the modal performs no additional read", () => {
    const refresh = vi.fn();
    setHook(
      {
        status: "success",
        data: [entry("c1", { title: "Otite externa" }, { name: "Luna" })],
        fetchedAt: new Date(),
      },
      { refresh },
    );
    render(<ClinicalView />);

    fireEvent.click(screen.getByTestId("clinical-case-action"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  // 9 — §22 no write affordance reached the screen
  it("9. neither the cards nor the modal expose an edit action", () => {
    const { container } = renderCases();
    fireEvent.click(caseActionFor("Luna"));

    expect(container.textContent).not.toContain("Editar");
    expect(container.textContent).not.toContain("Excluir");
    expect(container.querySelector("button[disabled]")).toBeNull();
  });

  // 10 — §26 a filter that removes the open case must not leave a stale modal.
  // The view resolves the selection against the CURRENT filtered list, so a case
  // that leaves the list closes its own modal rather than showing data the
  // current view no longer contains.
  it("10. filtering the open case out of the list closes its modal", () => {
    renderCases();
    fireEvent.click(caseActionFor("Thor"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Narrow the list to Luna's case only.
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "Luna" },
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
  });
});

/**
 * HW-6A.I4B §7/§8/§10/§16/§17 — the SECOND contextual interaction, at view level.
 *
 * The K9 modal is unit-tested on its own; what only the view can prove is the
 * WIRING: that the K9 identity action opens VISÃO CLÍNICA DO K9 for the right K9,
 * that the two modals are MUTUALLY EXCLUSIVE (§16), that the K9 view aggregates
 * from the PRE-FILTER authorized dataset rather than the filtered view (§10), that
 * it costs no additional read (§8), and that a K9 leaving the authorized scope
 * closes its own view (§17). The hook is mocked, so "no extra read" is provable.
 */
describe("HW-6A.I4B — card to K9 view integration", () => {
  /*
   * TWO K9s, and Luna deliberately owns TWO cases: the whole point of the K9 view
   * is the second axis (all cases of one K9), so a one-case-per-K9 fixture could
   * not tell aggregation apart from the card it was opened from.
   *
   * `dogId` is set on the CASE model, not on the `dog` override: `dog.id` is
   * derived from it, and `entry.dogId` — the key the K9 view resolves against — is
   * the case model's.
   */
  function renderScope() {
    setHook({
      status: "success",
      data: [
        entry(
          "c1",
          {
            dogId: "k9-luna",
            title: "Otite externa",
            clinicalStatus: "under_treatment",
          },
          { name: "Luna" },
        ),
        entry(
          "c2",
          { dogId: "k9-thor", title: "Claudicação", clinicalStatus: "open" },
          { name: "Thor" },
        ),
        entry(
          "c3",
          { dogId: "k9-luna", title: "Displasia", clinicalStatus: "monitoring" },
          { name: "Luna" },
        ),
      ],
      fetchedAt: new Date(),
    });
    return render(<ClinicalView />);
  }

  function cardByName(name: string): HTMLElement {
    const card = screen
      .getAllByTestId("clinical-case-card")
      .find((c) =>
        c
          .querySelector('[data-testid="clinical-card-k9-name"]')
          ?.textContent?.includes(name),
      );
    if (!card) throw new Error(`no card for ${name}`);
    return card;
  }

  function k9ActionByName(name: string): HTMLElement {
    return cardByName(name).querySelector(
      '[data-testid="clinical-card-k9-action"]',
    ) as HTMLElement;
  }

  function caseActionByName(name: string): HTMLElement {
    return cardByName(name).querySelector(
      '[data-testid="clinical-case-action"]',
    ) as HTMLElement;
  }

  // 1 — §7 the K9 identity action opens VISÃO CLÍNICA DO K9, not the case modal
  it("1. clicking the K9 action opens the K9 view for that K9", () => {
    renderScope();
    fireEvent.click(k9ActionByName("Thor"));

    expect(screen.getByTestId("clinical-k9-modal")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-k9-modal-name")).toHaveTextContent("Thor");
    // NOT the case summary modal.
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();
  });

  // 2 — §10 the K9 view aggregates ALL of that K9's authorized cases
  it("2. the K9 view lists every case that K9 has in the authorized scope", () => {
    renderScope();
    fireEvent.click(k9ActionByName("Luna"));

    // Luna has c1 (under_treatment) and c3 (monitoring): both active.
    expect(screen.getByTestId("clinical-k9-count-total")).toHaveTextContent("2");
    expect(screen.getByTestId("clinical-k9-count-active")).toHaveTextContent("2");
    const lines = screen.getAllByTestId("clinical-k9-case-line");
    expect(lines).toHaveLength(2);
  });

  // 3 — §16 the two modals are mutually exclusive: opening one closes the other
  it("3. opening the K9 view closes an open case modal, and vice versa", () => {
    renderScope();

    // Open the case modal first.
    fireEvent.click(caseActionByName("Thor"));
    expect(screen.getByTestId("clinical-case-modal")).toBeInTheDocument();

    // Opening the K9 view replaces it — never both at once.
    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getByTestId("clinical-k9-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();

    // And back the other way.
    fireEvent.click(caseActionByName("Thor"));
    expect(screen.getByTestId("clinical-case-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-k9-modal")).not.toBeInTheDocument();

    // Exactly one dialog is ever mounted.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  // 4 — §8 opening the K9 view triggers NO additional read
  it("4. opening the K9 view performs no additional read", () => {
    const refresh = vi.fn();
    setHook(
      {
        status: "success",
        data: [entry("c1", { title: "Otite externa" }, { name: "Luna", id: "k9-luna" })],
        fetchedAt: new Date(),
      },
      { refresh },
    );
    render(<ClinicalView />);

    fireEvent.click(screen.getByTestId("clinical-card-k9-action"));
    expect(screen.getByTestId("clinical-k9-modal")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  // 5 — §10 a filter that hides some of a K9's cards does NOT shrink the K9 view.
  //
  // The K9 view is derived from the PRE-FILTER authorized dataset, so filtering
  // the LIST down to one of Luna's cases still shows BOTH of her cases in her
  // clinical view — the view is about the authorized scope, not the filter.
  it("5. the K9 view is derived from the authorized scope, not the filtered list", () => {
    renderScope();

    // Narrow the visible list to the "Displasia" case only.
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "Displasia" },
    });
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);

    // Opening Luna's view from the one visible card still shows BOTH her cases.
    fireEvent.click(screen.getByTestId("clinical-card-k9-action"));
    expect(screen.getByTestId("clinical-k9-count-total")).toHaveTextContent("2");
    expect(screen.getAllByTestId("clinical-k9-case-line")).toHaveLength(2);
  });

  // 6 — §16/§28 the close control dismisses the K9 view
  it("6. the close control dismisses the K9 view", () => {
    renderScope();
    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByTestId("clinical-k9-modal")).not.toBeInTheDocument();
  });

  // 7 — §24 the open K9's identity actions reflect selection; case actions do not
  it("7. only the open K9's identity action is marked expanded", () => {
    renderScope();
    fireEvent.click(k9ActionByName("Thor"));

    expect(k9ActionByName("Thor")).toHaveAttribute("aria-expanded", "true");
    // Luna's card is a different K9 — not expanded.
    expect(k9ActionByName("Luna")).toHaveAttribute("aria-expanded", "false");
    // The case action on the same card is NOT expanded: the selections are distinct.
    expect(caseActionByName("Thor")).toHaveAttribute("aria-expanded", "false");
  });

  // 8 — §17 a K9 that leaves the authorized scope closes its own view.
  //
  // A refresh replaces the dataset with one that no longer contains Thor. The
  // view resolves the open dogId against the CURRENT authorized entries each
  // render, so Thor's view unmounts instead of showing stale clinical data.
  it("8. a K9 leaving the authorized scope closes its stale K9 view", () => {
    const { rerender } = renderScope();
    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getByTestId("clinical-k9-modal")).toHaveTextContent("Thor");

    // Authorized scope changes: Thor is gone.
    setHook({
      status: "success",
      data: [
        entry("c1", { title: "Otite externa" }, { name: "Luna", id: "k9-luna" }),
      ],
      fetchedAt: new Date(),
    });
    rerender(<ClinicalView />);

    expect(screen.queryByTestId("clinical-k9-modal")).not.toBeInTheDocument();
  });

  // 9 — §8/§21 opening the K9 view exposes no read/write affordance
  it("9. the K9 view exposes only the close control", () => {
    const { container } = renderScope();
    fireEvent.click(k9ActionByName("Luna"));

    const dialog = screen.getByRole("dialog");
    const buttons = [...dialog.querySelectorAll("button")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "Fechar");
    expect(dialog.querySelector("a")).toBeNull();
    expect(dialog.querySelector("[href]")).toBeNull();
    expect(dialog.querySelector("input")).toBeNull();
    expect(container.textContent).not.toContain("Editar");
  });
});

/*
 * HW-6A.I4B.F1 — STALE SELECTION INVALIDATION.
 *
 * I4B already proved the CLOSING half: a case leaving `filtered` and a K9 leaving
 * the authorized `entries` each unmount their own dialog. What it did not prove —
 * and what I4B.R1 found broken — is the RETURNING half. The selection was held as
 * an ID and merely failed to resolve, so the ID outlived the close: when the same
 * case/dog became resolvable again the dialog reopened BY ITSELF.
 *
 * That is a real interaction defect, not a cosmetic one. "A modal opens only by an
 * explicit user action" is the contract these tests pin down, in the exact shape
 * the defect took: disappear -> closed -> REAPPEAR -> STILL CLOSED -> activate ->
 * open. The third and fourth steps are the load-bearing ones; without them a
 * resurrection passes as green.
 *
 * The K9 arm carries one extra obligation: the fix must NOT be implemented by
 * deriving K9 validity from `filtered`, which would silently destroy I4B's
 * approved pre-filter contract. Test 3 exists to fail if it ever is.
 */
describe("HW-6A.I4B.F1 — stale selection invalidation", () => {
  const fullScope: ClinicalCaseListEntry[] = [
    entry(
      "c1",
      { dogId: "k9-luna", title: "Otite externa", clinicalStatus: "under_treatment" },
      { name: "Luna" },
    ),
    entry(
      "c2",
      { dogId: "k9-thor", title: "Claudicação", clinicalStatus: "open" },
      { name: "Thor" },
    ),
    entry(
      "c3",
      { dogId: "k9-luna", title: "Displasia", clinicalStatus: "monitoring" },
      { name: "Luna" },
    ),
  ];

  function publish(
    data: ClinicalCaseListEntry[],
    overrides: Partial<UseClinicalCasesResult> = {},
  ) {
    setHook({ status: "success", data, fetchedAt: new Date() }, overrides);
  }

  function cardByName(name: string): HTMLElement {
    const card = screen
      .getAllByTestId("clinical-case-card")
      .find((c) =>
        c
          .querySelector('[data-testid="clinical-card-k9-name"]')
          ?.textContent?.includes(name),
      );
    if (!card) throw new Error(`no card for ${name}`);
    return card;
  }

  function k9ActionByName(name: string): HTMLElement {
    return cardByName(name).querySelector(
      '[data-testid="clinical-card-k9-action"]',
    ) as HTMLElement;
  }

  function caseActionByName(name: string): HTMLElement {
    return cardByName(name).querySelector(
      '[data-testid="clinical-case-action"]',
    ) as HTMLElement;
  }

  function search(value: string) {
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value },
    });
  }

  // 1 — §5/§10 the CASE arm: a filtered-away case must not come back open
  it("1. a case modal closed by a filter does not reopen when the filter is cleared", () => {
    publish(fullScope);
    render(<ClinicalView />);

    fireEvent.click(caseActionByName("Thor"));
    expect(screen.getByTestId("clinical-case-modal")).toHaveTextContent(
      "Claudicação",
    );

    // DISAPPEAR: the filter removes the open case from the resolvable list.
    search("Displasia");
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();

    // REAPPEAR: clearing the filter brings the case back into the list...
    search("");
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(3);
    // ...and the modal MUST STAY CLOSED. The selection died with the close.
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The card no longer claims to have an open dialog either.
    expect(caseActionByName("Thor")).toHaveAttribute("aria-expanded", "false");

    // Only an explicit user action opens it again.
    fireEvent.click(caseActionByName("Thor"));
    expect(screen.getByTestId("clinical-case-modal")).toHaveTextContent(
      "Claudicação",
    );
  });

  // 2 — §6/§11 the K9 arm: a dog that left the dataset must not return open
  it("2. a K9 view closed by a dataset change does not reopen when the dog returns", () => {
    publish(fullScope);
    const { rerender } = render(<ClinicalView />);

    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getByTestId("clinical-k9-modal")).toHaveTextContent("Thor");

    // DISAPPEAR: a refresh/coverage change drops Thor from the authorized scope.
    publish(fullScope.filter((e) => e.dogId !== "k9-thor"));
    rerender(<ClinicalView />);
    expect(screen.queryByTestId("clinical-k9-modal")).not.toBeInTheDocument();

    // REAPPEAR: a later read restores him. This is the resurrection window.
    publish(fullScope);
    rerender(<ClinicalView />);
    expect(screen.queryByTestId("clinical-k9-modal")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(k9ActionByName("Thor")).toHaveAttribute("aria-expanded", "false");

    // And a fresh activation still works — the fix invalidates, it does not disable.
    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getByTestId("clinical-k9-modal")).toHaveTextContent("Thor");
  });

  // 3 — §7/§12 THE regression guard: K9 validity is still PRE-FILTER.
  //
  // Hiding every one of Luna's cards is a presentation act, not a scope change:
  // Luna is still in the authorized dataset, so her clinical view stays open and
  // still reports both her cases. An invalidation keyed to `filtered` would close
  // it here and silently undo the approved I4B contract.
  it("3. a filter hiding all of a K9's cards does not invalidate its K9 view", () => {
    publish(fullScope);
    render(<ClinicalView />);

    fireEvent.click(k9ActionByName("Luna"));
    expect(screen.getByTestId("clinical-k9-count-total")).toHaveTextContent("2");

    // Every visible Luna card is filtered away — only Thor's remains.
    search("Claudicação");
    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(1);
    expect(
      cardByName("Thor").querySelector('[data-testid="clinical-card-k9-name"]'),
    ).toHaveTextContent("Thor");

    // Luna's view is untouched: still open, still her whole authorized scope.
    expect(screen.getByTestId("clinical-k9-modal")).toHaveTextContent("Luna");
    expect(screen.getByTestId("clinical-k9-count-total")).toHaveTextContent("2");
    expect(screen.getAllByTestId("clinical-k9-case-line")).toHaveLength(2);
  });

  // 4 — §13/§15 invalidation is local state only: no read, no stacking
  it("4. invalidation triggers no read and keeps the modals mutually exclusive", () => {
    const refresh = vi.fn();
    publish(fullScope, { refresh });
    const { rerender } = render(<ClinicalView />);

    fireEvent.click(caseActionByName("Thor"));
    search("Displasia");
    search("");
    fireEvent.click(k9ActionByName("Thor"));
    publish(fullScope.filter((e) => e.dogId !== "k9-thor"), { refresh });
    rerender(<ClinicalView />);
    publish(fullScope, { refresh });
    rerender(<ClinicalView />);

    // A whole disappear/reappear cycle on both arms cost zero reads.
    expect(refresh).not.toHaveBeenCalled();
    // And left nothing open behind it.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Mutual exclusion still holds after the invalidation path has run.
    fireEvent.click(caseActionByName("Thor"));
    fireEvent.click(k9ActionByName("Thor"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByTestId("clinical-k9-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-case-modal")).not.toBeInTheDocument();
  });
});
