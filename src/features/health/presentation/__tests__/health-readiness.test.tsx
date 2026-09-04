/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Test Suite for the Readiness Workforce View (/health/readiness)
 *
 * Validates the HW-3C mandates, most importantly the canonical invariant:
 *
 *   missing projection  !==  not_evaluated
 *
 * `not_evaluated` is a VALID operational readiness status produced by Backend.
 * A missing/invalid projection is a TECHNICAL read state.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, waitFor } from "@testing-library/react";

type MockAccess = {
  profile: { status?: string; permissions?: Record<string, unknown>; scope?: string } | null;
  status: "fallback" | "loading" | "ready";
};

const accessState = vi.hoisted(() => ({
  current: {
    status: "ready" as const,
    profile: {
      status: "active",
      permissions: { health: { read: true } },
      scope: "own_records",
    },
  } as MockAccess,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

vi.mock("../hooks/load-readiness-scope", () => ({
  loadReadinessScope: vi.fn(),
}));

import { HealthReadinessTable } from "../components/health-readiness-table";
import { HealthReadinessSummaryCards } from "../components/health-readiness-summary-cards";
import { HealthReadinessFilters } from "../components/health-readiness-filters";
import { HealthReadinessCoveragePanel } from "../components/health-readiness-coverage";
import {
  HealthReadinessSkeleton,
  HealthReadinessEmpty,
  HealthReadinessError,
} from "../components/health-readiness-states";
import { aggregateReadinessListItem } from "../../domain/readiness-aggregator";
import {
  DEFAULT_READINESS_FILTERS,
  type ReadinessStatusCounts,
} from "../hooks/readiness-view-model";
import { useHealthReadiness } from "../hooks/use-health-readiness";
import { loadReadinessScope } from "../hooks/load-readiness-scope";
import type {
  CanonicalHealthSummaryDoc,
  CanonicalRestrictionDoc,
  DogIdentityReadModel,
  ReadinessListItem,
  ReadinessStatus,
} from "../../domain/readiness-types";

// ---------------------------------------------------------------------------
// Fixtures — synthetic scope from §28
// ---------------------------------------------------------------------------

function dog(id: string, name: string, registration: string, conductor?: string): DogIdentityReadModel {
  return {
    id,
    name,
    registrationNumber: registration,
    photoUrl: null,
    breed: "Pastor Belga",
    sex: "M",
    dateOfBirth: null,
    conductor: conductor ? { ra: "691755", name: conductor } : null,
    specialties: [],
  };
}

function summary(
  dogId: string,
  readinessStatus: ReadinessStatus,
  reason: string,
  updatedAt: Date,
): CanonicalHealthSummaryDoc {
  return {
    dogId,
    readinessStatus,
    readinessLabel: readinessStatus,
    readinessReason: reason,
    readinessUpdatedAt: updatedAt,
    lastEvaluatedAt: updatedAt,
    updatedAt,
    evaluatedBy: "function_v1",
    activeRestrictions: [],
    restrictionCount: { absolute: 0, partial: 0, attention: 0 },
    dataCompleteness: null,
    activeCasesCount: 0,
    activeTreatmentsCount: 0,
    pendingScheduleCount: 0,
    overdueScheduleCount: 0,
    schemaVersion: 1,
    rawWireDoc: {},
  } as CanonicalHealthSummaryDoc;
}

const NOW = new Date();

/** Dog A: operational, fresh. */
const itemA = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-a", "Apolo", "123456", "Castro Silva"),
    summary: summary("k9-a", "operational", "Evidências em conformidade", NOW),
    restrictions: [],
  });

/** Dog B: operational_attention, fresh. */
const itemB = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-b", "Bono", "111222", "Ragonha"),
    summary: summary("k9-b", "operational_attention", "Exame clínico pendente", NOW),
    restrictions: [],
  });

/**
 * Dog C: fit_with_restrictions with a PARTIAL read.
 *
 * The active partial restriction is REQUIRED: a `fit_with_restrictions`
 * projection with zero active restrictions is a genuine structural conflict
 * (conflict-model.ts Case B). Supplying it keeps this fixture a clean
 * "partial read, no conflict" case, which is what §19 asks us to prove.
 */
const partialRestriction = {
  id: "r-c1",
  dogId: "k9-c",
  level: "partial",
  status: "active",
  description: "Restrição parcial vigente",
  activitiesRestricted: ["mordida"],
  issuedAt: NOW,
  recordedBy: null,
  professional: null,
  sourceDocument: null,
  expectedEnd: null,
  actualEnd: null,
  caseId: null,
} as unknown as CanonicalRestrictionDoc;

const itemC = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-c", "Cesar", "333444"),
    summary: {
      ...summary("k9-c", "fit_with_restrictions", "Restrição parcial vigente", NOW),
      restrictionCount: { absolute: 0, partial: 1, attention: 0 },
    },
    restrictions: [partialRestriction],
    dataQuality: {
      status: "partial",
      partialData: {},
      failedSources: ["clinical_cases"],
      successfulSources: ["health_summary"],
    },
  });

/** Dog D: VALID not_evaluated projection. */
const itemD = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-d", "Duke", "555666"),
    summary: summary("k9-d", "not_evaluated", "Nenhuma avaliação registrada", NOW),
    restrictions: [],
  });

/** Dog E: MISSING health_summary — technical state only. */
const itemE = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-e", "Eros", "777888"),
    summary: null,
    restrictions: [],
    dataQuality: { status: "empty", query: "dogs/k9-e/health_summary/current" },
  });

const fullScope = (): ReadinessListItem[] => [itemA(), itemB(), itemC(), itemD(), itemE()];

/** Mirrors the hook's strict counting rule (§9). */
function countStatuses(items: ReadinessListItem[]): ReadinessStatusCounts {
  const counts: ReadinessStatusCounts = {
    operational: 0,
    operational_attention: 0,
    fit_with_restrictions: 0,
    temporarily_unfit: 0,
    not_evaluated: 0,
  };

  for (const item of items) {
    if (item.summary !== null) {
      counts[item.readinessStatus] += 1;
    }
  }

  return counts;
}

const noopFilters = {
  filters: DEFAULT_READINESS_FILTERS,
  onChange: () => {},
  onReset: () => {},
  filtersActive: false,
  resultCount: 0,
};

// ---------------------------------------------------------------------------

describe("HW-3C — operational summary counts", () => {
  it("1. Counts the five valid statuses from valid projections only", () => {
    const counts = countStatuses(fullScope());

    expect(counts).toEqual({
      operational: 1,
      operational_attention: 1,
      fit_with_restrictions: 1,
      temporarily_unfit: 0,
      not_evaluated: 1,
    });
  });

  it("2. Missing summary is NOT counted as not_evaluated", () => {
    const counts = countStatuses([itemE()]);

    expect(counts.not_evaluated).toBe(0);
    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
  });

  it("3. A valid not_evaluated projection IS counted", () => {
    const counts = countStatuses([itemD()]);

    expect(counts.not_evaluated).toBe(1);
  });

  it("4. Cards expose accessible labels and never truncate semantics", () => {
    render(
      <HealthReadinessSummaryCards
        counts={countStatuses(fullScope())}
        selectedStatus="all"
        onSelectStatus={() => {}}
      />,
    );

    for (const label of [
      "Operacional",
      "Operacional com atenção",
      "Apto com restrições",
      "Temporariamente inapto",
      "Não avaliado",
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }

    // Mockup copy "sem projeção válida" must NOT label the not_evaluated card.
    expect(screen.queryByText("sem projeção válida")).toBeNull();
  });

  it("5. Clicking a card toggles the status filter", () => {
    const onSelectStatus = vi.fn();
    render(
      <HealthReadinessSummaryCards
        counts={countStatuses(fullScope())}
        selectedStatus="all"
        onSelectStatus={onSelectStatus}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Temporariamente inapto/i }));
    expect(onSelectStatus).toHaveBeenCalledWith("temporarily_unfit");
  });
});

describe("HW-3C — missing projection vs not_evaluated", () => {
  it("6. Missing projection renders the technical state, not the operational badge", () => {
    render(<HealthReadinessTable items={[itemE()]} filtersActive={false} onResetFilters={() => {}} />);

    expect(screen.getAllByText("Sem projeção válida").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Não avaliado")).toBeNull();
    expect(
      screen.getAllByText("A prontidão operacional ainda não pôde ser determinada.").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("7. Missing projection does not fabricate reason, restrictions or date", () => {
    render(<HealthReadinessTable items={[itemE()]} filtersActive={false} onResetFilters={() => {}} />);

    expect(screen.queryByText("Nenhuma avaliação registrada")).toBeNull();
    // Restrictions and timestamp collapse to the unavailable marker.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Nenhuma restrição ativa")).toBeNull();
  });

  it("8. Valid not_evaluated renders the operational badge", () => {
    render(<HealthReadinessTable items={[itemD()]} filtersActive={false} onResetFilters={() => {}} />);

    expect(screen.getAllByText("Não avaliado").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Sem projeção válida")).toBeNull();
  });
});

describe("HW-3C — technical quality states", () => {
  it("9. Partial stays distinct from conflict and keeps its operational status", () => {
    const item = itemC();

    expect(item.qualityLabel).toBe("Parcial");
    expect(item.conflict?.hasConflict ?? false).toBe(false);
    expect(item.readinessStatus).toBe("fit_with_restrictions");

    render(<HealthReadinessTable items={[item]} filtersActive={false} onResetFilters={() => {}} />);

    expect(screen.getAllByText("Parcial").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Conflito")).toBeNull();
    // Partial is NOT downgraded into missing.
    expect(screen.queryByText("Sem projeção válida")).toBeNull();
    expect(screen.getAllByText("Apto com restrições").length).toBeGreaterThanOrEqual(1);
  });

  it("10. Freshness column uses the canonical read model timestamp", () => {
    const item = itemA();

    expect(item.freshness.readinessUpdatedAt).not.toBeNull();
    expect(item.updatedAt).not.toBeNull();

    render(<HealthReadinessTable items={[item]} filtersActive={false} onResetFilters={() => {}} />);

    const expected = item.updatedAt!.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(1);
  });

  it("11. Technical coverage reports read quality without any score or percentage", () => {
    render(
      <HealthReadinessCoveragePanel
        coverage={{
          totalInScope: 5,
          validProjections: 4,
          partialReads: 1,
          missingProjections: 1,
          staleReads: 0,
          conflicts: 0,
        }}
      />,
    );

    expect(screen.getByTestId("health-readiness-coverage")).toBeDefined();
    expect(screen.getByText("projeções válidas")).toBeDefined();
    expect(screen.getByText("leitura parcial")).toBeDefined();
    expect(screen.getByText("sem projeção válida")).toBeDefined();
    // Never a health score.
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
  });
});

describe("HW-3C — list presentation", () => {
  it("12. Renders 'Fonte: Canônica' and hides technical internals", () => {
    const { container } = render(
      <HealthReadinessTable items={fullScope()} filtersActive={false} onResetFilters={() => {}} />,
    );

    expect(screen.getAllByText("Fonte: Canônica").length).toBeGreaterThanOrEqual(1);

    const html = container.innerHTML;
    expect(html).not.toContain("health_summary/current");
    expect(html).not.toContain("schemaVersion");
    expect(html).not.toContain("schema_version");
    // Raw wire enums must not leak as visible labels.
    expect(html).not.toContain(">operational_attention<");
  });

  it("13. Cockpit link targets /health/readiness/{dogId} preserving the id", () => {
    render(<HealthReadinessTable items={[itemA()]} filtersActive={false} onResetFilters={() => {}} />);

    const links = screen.getAllByRole("link", { name: /Ver cockpit de prontidão do K9 Apolo/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].getAttribute("href")).toBe("/health/readiness/k9-a");
  });

  it("14. Exposes no mutation controls (read-only page)", () => {
    render(<HealthReadinessTable items={fullScope()} filtersActive={false} onResetFilters={() => {}} />);

    for (const forbidden of [/liberar/i, /cancelar/i, /editar/i, /criar/i, /excluir/i, /salvar/i]) {
      expect(screen.queryByRole("button", { name: forbidden })).toBeNull();
    }
  });

  it("15. Uses a semantic table with an accessible caption on wide layouts", () => {
    const { container } = render(
      <HealthReadinessTable items={fullScope()} filtersActive={false} onResetFilters={() => {}} />,
    );

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("caption")).not.toBeNull();
    expect(container.querySelectorAll("th[scope='col']").length).toBe(8);
    // Narrow-width representation exists so the table is not squeezed.
    expect(container.querySelector('[data-testid="health-readiness-cards"]')).not.toBeNull();
  });

  it("16. No-results state offers a filter reset", () => {
    const onResetFilters = vi.fn();
    render(<HealthReadinessTable items={[]} filtersActive={true} onResetFilters={onResetFilters} />);

    expect(screen.getByText("Nenhum K9 corresponde aos filtros aplicados.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onResetFilters).toHaveBeenCalled();
  });
});

describe("HW-3C — filters and search", () => {
  it("17. Exposes labelled, keyboard-accessible filter controls", () => {
    render(<HealthReadinessFilters {...noopFilters} />);

    expect(screen.getByLabelText(/Buscar por K9, matrícula ou condutor/i)).toBeDefined();
    expect(screen.getByLabelText("Status:")).toBeDefined();
    expect(screen.getByLabelText("Leitura:")).toBeDefined();
    expect(screen.getByLabelText("Restrições:")).toBeDefined();
    expect(screen.getByLabelText("Ordenação:")).toBeDefined();
  });

  it("18. Technical quality options use the homologated vocabulary", () => {
    render(<HealthReadinessFilters {...noopFilters} />);

    const quality = screen.getByLabelText("Leitura:") as HTMLSelectElement;
    const values = Array.from(quality.options).map((option) => option.value);

    expect(values).toEqual([
      "all",
      "Atualizada",
      "Desatualizada",
      "Parcial",
      "Conflito",
      "Sem projeção válida",
    ]);
  });

  it("19. Status and search changes are reported to the caller", () => {
    const onChange = vi.fn();
    render(<HealthReadinessFilters {...noopFilters} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Status:"), { target: { value: "not_evaluated" } });
    expect(onChange).toHaveBeenCalledWith({ status: "not_evaluated" });

    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), { target: { value: "Apolo" } });
    expect(onChange).toHaveBeenCalledWith({ search: "Apolo" });
  });

  it("20. Reset control only appears while filters are active", () => {
    const onReset = vi.fn();
    const { rerender } = render(<HealthReadinessFilters {...noopFilters} />);
    expect(screen.queryByRole("button", { name: /Limpar filtros/i })).toBeNull();

    rerender(<HealthReadinessFilters {...noopFilters} filtersActive={true} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onReset).toHaveBeenCalled();
  });
});

describe("HW-3C — technical states", () => {
  it("21. Skeleton never renders fake counts or a placeholder status", () => {
    const { container } = render(<HealthReadinessSkeleton />);

    expect(screen.getByTestId("health-readiness-skeleton")).toBeDefined();
    expect(container.textContent).not.toContain("0");
    expect(container.textContent).not.toContain("Não avaliado");
    expect(container.textContent).not.toContain("Sem projeção válida");
  });

  it("22. Empty scope is a true empty state, not a projection failure", () => {
    render(<HealthReadinessEmpty />);

    expect(screen.getByText("Nenhum K9 disponível no escopo atual.")).toBeDefined();
    expect(screen.queryByText(/Sem projeção válida/i)).toBeNull();
    expect(screen.queryByText(/degradada/i)).toBeNull();
  });

  it("23. Global error presumes no operational state and offers retry", () => {
    const onRetry = vi.fn();
    render(<HealthReadinessError message="Erro de rede" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Nenhum estado operacional foi presumido/i)).toBeDefined();
    expect(screen.queryByText("Não avaliado")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("HW-5.WEB-READINESS.FIX1 — strict workforce authority & read ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessState.current = {
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { read: true } },
        scope: "own_records",
      },
    };
  });

  it("24. KILLER CASE — gestor (health.view=true, health.read absent) is forbidden and causes 0 loader calls", () => {
    accessState.current = {
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { view: true } },
        scope: "global",
      },
    };

    const { result } = renderHook(() => useHealthReadiness());

    expect(result.current.status).toBe("forbidden");
    expect(result.current.items).toEqual([]);
    expect(loadReadinessScope).toHaveBeenCalledTimes(0);
  });

  it("25. Inactive profile with health.read=true is forbidden and causes 0 loader calls", () => {
    accessState.current = {
      status: "ready",
      profile: {
        status: "inactive",
        permissions: { health: { read: true } },
      },
    };

    const { result } = renderHook(() => useHealthReadiness());

    expect(result.current.status).toBe("forbidden");
    expect(result.current.items).toEqual([]);
    expect(loadReadinessScope).toHaveBeenCalledTimes(0);
  });

  it("26. Loading authority yields loading status and causes 0 loader calls", () => {
    accessState.current = {
      status: "loading",
      profile: null,
    };

    const { result } = renderHook(() => useHealthReadiness());

    expect(result.current.status).toBe("loading");
    expect(result.current.items).toEqual([]);
    expect(loadReadinessScope).toHaveBeenCalledTimes(0);
  });

  it("27. Canonical allowed user (health.read=true) initiates data load", async () => {
    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [],
      activeRestrictions: [],
      restrictionsCoverageComplete: true,
      isPartial: false,
      scopeEmpty: true,
    });

    const { result } = renderHook(() => useHealthReadiness());

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });

    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
  });

  it("28. Authority transition safety — switching to forbidden clears data and prevents stale exposure", async () => {
    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [
        aggregateReadinessListItem({
          dog: dog("d1", "Thor", "GCM-001"),
          summary: summary("d1", "operational", "Apto", new Date()),
          restrictions: [],
        }),
      ],
      activeRestrictions: [],
      restrictionsCoverageComplete: true,
      isPartial: false,
      scopeEmpty: false,
    });

    const { result, rerender } = renderHook(() => useHealthReadiness());

    await waitFor(() => {
      expect(result.current.status).toBe("success");
      expect(result.current.items.length).toBe(1);
    });

    // Session switches to forbidden gestor
    accessState.current = {
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { view: true } },
        scope: "global",
      },
    };

    rerender();

    expect(result.current.status).toBe("forbidden");
    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    // No new loader execution
    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
  });
});

