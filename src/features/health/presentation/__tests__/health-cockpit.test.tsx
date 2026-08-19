/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Test Suite for the Individual Readiness Cockpit (/health/readiness/[dogId])
 *
 * Locks the cockpit presentation contract, most importantly:
 *
 *   missing projection  !==  not_evaluated
 *
 * `not_evaluated` is a VALID operational readiness status produced by Backend.
 * A missing/invalid projection is a TECHNICAL read state.
 *
 * Also locks that AVAILABLE, UNAVAILABLE and SUCCESSFUL-EMPTY are three
 * different things, and that the cockpit renders no mutation control.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthCockpitHeader } from "../components/health-cockpit-header";
import {
  CockpitClinicalContext,
  CockpitCompleteness,
  CockpitPreventiveEvidence,
  CockpitRestrictions,
  CockpitTimeline,
} from "../components/health-cockpit-sections";
import { aggregateReadinessCockpit } from "../../domain/readiness-aggregator";
import type {
  CanonicalHealthSummaryDoc,
  CanonicalRestrictionDoc,
  DogIdentityReadModel,
  EvidenceAvailability,
  OperationalRestrictionReadModel,
  ReadinessStatus,
} from "../../domain/readiness-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-10T12:00:00.000Z");

function dog(overrides: Partial<DogIdentityReadModel> = {}): DogIdentityReadModel {
  return {
    id: "k9-bono",
    name: "Bono",
    registrationNumber: "111222",
    photoUrl: null,
    breed: "Pastor Belga Malinois",
    sex: "M",
    dateOfBirth: null,
    conductor: { ra: "691755", name: "Ragonha" },
    specialties: [],
    ...overrides,
  } as DogIdentityReadModel;
}

function summary(
  readinessStatus: ReadinessStatus,
  overrides: Partial<CanonicalHealthSummaryDoc> = {},
): CanonicalHealthSummaryDoc {
  return {
    dogId: "k9-bono",
    readinessStatus,
    readinessLabel: readinessStatus,
    readinessReason: "Exame clínico pendente",
    readinessUpdatedAt: NOW,
    lastEvaluatedAt: NOW,
    updatedAt: NOW,
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
    ...overrides,
  } as CanonicalHealthSummaryDoc;
}

function restriction(
  level: "absolute" | "partial" | "attention",
  overrides: Partial<CanonicalRestrictionDoc> = {},
): CanonicalRestrictionDoc {
  return {
    id: `r-${level}`,
    dogId: "k9-bono",
    level,
    status: "active",
    description: `Restrição ${level} vigente`,
    activitiesRestricted: ["mordida"],
    issuedAt: NOW,
    recordedBy: null,
    professional: null,
    sourceDocument: null,
    expectedEnd: null,
    actualEnd: null,
    caseId: null,
    ...overrides,
  } as unknown as CanonicalRestrictionDoc;
}

const cockpitOf = (
  s: CanonicalHealthSummaryDoc | null,
  restrictions: CanonicalRestrictionDoc[] = [],
) => aggregateReadinessCockpit({ dog: dog(), summary: s, restrictions, now: NOW });

/**
 * Generic unavailable fixture for "the block states its reason" assertions.
 *
 * The wording is a projection-aware one, NOT "leitura detalhada ainda não
 * integrada": weight is integrated through the projected digest, so claiming it
 * is unimplemented would be false — the defect this suite now guards against.
 */
const unavailable: EvidenceAvailability = {
  available: false,
  reason: "Dado de peso não disponível nesta projeção.",
  data: null,
};

function renderHeader(
  s: CanonicalHealthSummaryDoc | null,
  restrictions: CanonicalRestrictionDoc[] = [],
) {
  const c = cockpitOf(s, restrictions);
  render(
    <HealthCockpitHeader
      dog={c.dog}
      readinessStatus={c.readinessStatus}
      hasValidProjection={c.summary !== null}
      reason={c.reason}
      qualityLabel={c.qualityLabel}
      readinessUpdatedAt={c.summary?.readinessUpdatedAt ?? null}
    />,
  );
  return c;
}

// ---------------------------------------------------------------------------
// Core readiness states
// ---------------------------------------------------------------------------

describe("HW-3D — cockpit readiness states", () => {
  it("1. renders the operational status and its reason", () => {
    renderHeader(summary("operational", { readinessReason: "Evidências em conformidade" }));
    expect(screen.getByText("Operacional")).toBeDefined();
    expect(screen.getByText("Evidências em conformidade")).toBeDefined();
  });

  it("2. renders operational_attention", () => {
    renderHeader(summary("operational_attention"));
    expect(screen.getByText("Operacional com atenção")).toBeDefined();
  });

  it("3. renders fit_with_restrictions", () => {
    renderHeader(
      summary("fit_with_restrictions", {
        restrictionCount: { absolute: 0, partial: 1, attention: 0 },
      }),
      [restriction("partial")],
    );
    expect(screen.getByText("Apto com restrições")).toBeDefined();
  });

  it("4. renders temporarily_unfit", () => {
    renderHeader(
      summary("temporarily_unfit", {
        restrictionCount: { absolute: 1, partial: 0, attention: 0 },
      }),
      [restriction("absolute")],
    );
    expect(screen.getByText("Temporariamente inapto")).toBeDefined();
  });

  it("5. a VALID not_evaluated projection renders the operational status", () => {
    renderHeader(summary("not_evaluated", { readinessReason: "Nenhuma avaliação registrada" }));
    expect(screen.getByText("Não avaliado")).toBeDefined();
    expect(screen.queryByText("Sem projeção válida")).toBeNull();
  });

  it("6. INVARIANT: a missing projection is NEVER rendered as 'Não avaliado'", () => {
    renderHeader(null);
    // Appears twice: the readiness badge and the technical quality chip.
    expect(screen.getAllByText("Sem projeção válida").length).toBeGreaterThan(0);
    expect(screen.queryByText("Não avaliado")).toBeNull();
    expect(
      screen.getByText("A prontidão operacional ainda não pôde ser determinada."),
    ).toBeDefined();
  });

  it("7. dog identity still renders when the projection is missing", () => {
    renderHeader(null);
    expect(screen.getByText("Bono")).toBeDefined();
    expect(screen.getByText(/111222/)).toBeDefined();
    expect(screen.getByText(/Ragonha/)).toBeDefined();
  });

  it("8. freshness comes from readiness_updated_at", () => {
    renderHeader(summary("operational"));
    expect(screen.getByText(/Projeção atualizada em/)).toBeDefined();
  });

  it("9. operational status and technical quality are separate dimensions", () => {
    const c = cockpitOf(summary("operational_attention"));
    render(
      <HealthCockpitHeader
        dog={c.dog}
        readinessStatus={c.readinessStatus}
        hasValidProjection
        reason={c.reason}
        qualityLabel="Parcial"
        readinessUpdatedAt={NOW}
      />,
    );
    expect(screen.getByText("Operacional com atenção")).toBeDefined();
    expect(screen.getByText("Parcial")).toBeDefined();
    expect(screen.getByText("Estado da leitura")).toBeDefined();
  });

  it("10. back navigation targets the workforce list", () => {
    renderHeader(summary("operational"));
    const link = screen.getByRole("link", { name: /Voltar à prontidão do efetivo/i });
    expect(link.getAttribute("href")).toBe("/health/readiness");
  });
});

// ---------------------------------------------------------------------------
// Restrictions
// ---------------------------------------------------------------------------

describe("HW-3D — cockpit restrictions", () => {
  const normalized = (level: "absolute" | "partial" | "attention") =>
    cockpitOf(summary("fit_with_restrictions"), [restriction(level)]).restrictions;

  it("11. renders an active absolute restriction", () => {
    render(<CockpitRestrictions restrictions={normalized("absolute")} coverageComplete />);
    expect(screen.getByText("Restrição absoluta")).toBeDefined();
    expect(screen.getByText("Restrição absolute vigente")).toBeDefined();
  });

  it("12. renders partial and attention levels distinctly", () => {
    const both = [...normalized("partial"), ...normalized("attention")];
    render(<CockpitRestrictions restrictions={both} coverageComplete />);
    expect(screen.getByText("Restrição parcial")).toBeDefined();
    expect(screen.getByText("Restrição de atenção")).toBeDefined();
    expect(screen.getByText("2 restrições")).toBeDefined();
  });

  it("13. absence is affirmed ONLY when the read succeeded", () => {
    render(<CockpitRestrictions restrictions={[]} coverageComplete />);
    expect(screen.getByText("Nenhuma restrição operacional ativa")).toBeDefined();
  });

  it("14. zero restrictions over an INCOMPLETE read does NOT affirm absence", () => {
    render(<CockpitRestrictions restrictions={[]} coverageComplete={false} />);
    expect(screen.queryByText("Nenhuma restrição operacional ativa")).toBeNull();
    expect(
      screen.getByText(
        "Não foi possível confirmar as restrições ativas com os dados disponíveis.",
      ),
    ).toBeDefined();
  });

  it("14b. an unavailable read renders NO '0 restrições' count (false zero)", () => {
    render(<CockpitRestrictions restrictions={[]} coverageComplete={false} />);
    // A count asserts an absence nobody verified.
    expect(screen.queryByText(/0\s+restriç/)).toBeNull();
    expect(screen.getByText("Indisponível")).toBeDefined();
  });

  it("14c. a SUCCESSFUL empty read does render the '0 restrições' count", () => {
    render(<CockpitRestrictions restrictions={[]} coverageComplete />);
    expect(screen.getByText(/0\s+restriç/)).toBeDefined();
    expect(screen.queryByText("Indisponível")).toBeNull();
  });

  it("15. a past expected_end does NOT mark an active restriction as ended", () => {
    const past = new Date("2020-01-01T00:00:00.000Z");
    const items = cockpitOf(summary("fit_with_restrictions"), [
      restriction("partial", { expectedEnd: past }),
    ]).restrictions;

    render(<CockpitRestrictions restrictions={items} coverageComplete />);
    expect(screen.getByText("Restrição parcial")).toBeDefined();
    expect(screen.queryByText(/Encerrada/i)).toBeNull();
  });

  it("16. renders NO mutation control", () => {
    render(<CockpitRestrictions restrictions={normalized("absolute")} coverageComplete />);
    for (const forbidden of [/Criar/i, /Editar/i, /Encerrar/i, /Liberar/i, /Cancelar/i]) {
      expect(screen.queryByRole("button", { name: forbidden })).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Secondary evidence: available vs unavailable vs successful-empty
// ---------------------------------------------------------------------------

describe("HW-3D — cockpit secondary evidence", () => {
  it("17. projected weight/vaccination/nutrition render with provenance", () => {
    const c = cockpitOf(
      summary("operational", {
        lastWeight: { kg: 29.8, measuredAt: NOW, bcs: 5 },
        lastVaccination: { type: "V10", date: NOW, nextDue: null },
        nutritionPlan: { active: true, foodType: "Ração Premium", amountGrams: 600 },
      }),
    );

    render(
      <CockpitPreventiveEvidence
        weightEvidence={c.weightEvidence}
        vaccinationEvidence={c.vaccinationEvidence}
        nutritionSummary={c.nutritionSummary}
      />,
    );

    expect(screen.getByText("29.8 kg")).toBeDefined();
    expect(screen.getByText("V10")).toBeDefined();
    expect(screen.getByText("Plano ativo")).toBeDefined();
    // Provenance must be explicit: projection digest, not the detailed reader.
    expect(screen.getByText(/resumo projetado da prontidão canônica/i)).toBeDefined();
  });

  it("18. weight shows NO clinical interpretation", () => {
    const c = cockpitOf(summary("operational", { lastWeight: { kg: 29.8, measuredAt: NOW } }));
    render(
      <CockpitPreventiveEvidence
        weightEvidence={c.weightEvidence}
        vaccinationEvidence={c.vaccinationEvidence}
        nutritionSummary={c.nutritionSummary}
      />,
    );
    for (const verdict of [/abaixo do peso/i, /sobrepeso/i, /peso ideal/i, /risco/i]) {
      expect(screen.queryByText(verdict)).toBeNull();
    }
  });

  it("19. an absent projected field is UNAVAILABLE, never zero", () => {
    const c = cockpitOf(summary("operational")); // no lastWeight
    render(
      <CockpitPreventiveEvidence
        weightEvidence={c.weightEvidence}
        vaccinationEvidence={c.vaccinationEvidence}
        nutritionSummary={c.nutritionSummary}
      />,
    );
    expect(screen.getAllByText("Evidência indisponível").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 kg")).toBeNull();
  });

  it("20. no valid summary keeps every evidence block unavailable", () => {
    const c = cockpitOf(null);
    render(
      <CockpitPreventiveEvidence
        weightEvidence={c.weightEvidence}
        vaccinationEvidence={c.vaccinationEvidence}
        nutritionSummary={c.nutritionSummary}
      />,
    );
    expect(screen.getAllByText("Evidência indisponível")).toHaveLength(3);
  });

  it("21. clinical and schedule digests render from the projection", () => {
    const c = cockpitOf(
      summary("operational", {
        activeCasesCount: 2,
        activeTreatmentsCount: 1,
        pendingScheduleCount: 3,
        overdueScheduleCount: 0,
      }),
    );
    render(
      <CockpitClinicalContext
        clinicalSummary={c.clinicalSummary}
        scheduleSummary={c.scheduleSummary}
      />,
    );
    expect(screen.getByText("Casos ativos")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Agenda pendente")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("22. timeline stays unavailable: it has no reader in this version", () => {
    const c = cockpitOf(summary("operational"));
    render(<CockpitTimeline timelineSummary={c.timelineSummary} />);
    expect(screen.getByText("Evidência indisponível")).toBeDefined();
    expect(screen.getByText(/Histórico: leitura detalhada ainda não integrada/)).toBeDefined();
  });

  it("22b. an ABSENT projected digest must NOT claim the domain is unintegrated", () => {
    // Summary read fine; it simply carries no weight/vaccination/nutrition digest.
    const c = cockpitOf(summary("operational"));
    render(
      <CockpitPreventiveEvidence
        weightEvidence={c.weightEvidence}
        vaccinationEvidence={c.vaccinationEvidence}
        nutritionSummary={c.nutritionSummary}
      />,
    );

    expect(screen.getByText("Dado de peso não disponível nesta projeção.")).toBeDefined();
    expect(screen.getByText("Dado de vacinação não disponível nesta projeção.")).toBeDefined();
    expect(screen.getByText("Dado nutricional não disponível nesta projeção.")).toBeDefined();
    // These domains ARE integrated via the projection: never call them unimplemented.
    expect(screen.queryByText(/ainda não integrada/)).toBeNull();
  });

  it("22c. no valid summary says so explicitly, not 'not integrated'", () => {
    const c = cockpitOf(null);
    render(
      <>
        <CockpitPreventiveEvidence
          weightEvidence={c.weightEvidence}
          vaccinationEvidence={c.vaccinationEvidence}
          nutritionSummary={c.nutritionSummary}
        />
        <CockpitClinicalContext
          clinicalSummary={c.clinicalSummary}
          scheduleSummary={c.scheduleSummary}
        />
      </>,
    );

    expect(
      screen.getAllByText("Sem projeção válida para disponibilizar este resumo.").length,
    ).toBe(5);
    expect(screen.queryByText(/ainda não integrada/)).toBeNull();
  });

  it("22d. only the timeline is classified as unintegrated", () => {
    const c = cockpitOf(summary("operational"));
    const reasons = [
      c.weightEvidence,
      c.vaccinationEvidence,
      c.nutritionSummary,
      c.scheduleSummary,
      c.clinicalSummary,
    ].map((e) => e.reason);

    for (const reason of reasons) {
      expect(reason).not.toMatch(/ainda não integrada/);
    }
    expect(c.timelineSummary.reason).toMatch(/ainda não integrada/);
  });

  it("23. completeness explains coverage without inventing a score", () => {
    render(
      <CockpitCompleteness
        completeness={{
          hasRecentWeight: true,
          hasActiveNutrition: false,
          hasVaccinationCurrent: true,
          hasRecentExam: false,
        }}
      />,
    );
    expect(screen.getByText("Peso recente")).toBeDefined();
    // State is carried by text as well as colour.
    expect(screen.getAllByText("registrado")).toHaveLength(2);
    expect(screen.getAllByText("pendente")).toHaveLength(2);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("24. absent completeness is unavailable, not all-false", () => {
    render(<CockpitCompleteness completeness={null} />);
    expect(
      screen.getByText("Cobertura das evidências não disponível nesta projeção."),
    ).toBeDefined();
    expect(screen.queryByText("registrado")).toBeNull();
  });

  it("25. an unavailable block states the reason it could not be read", () => {
    render(
      <CockpitPreventiveEvidence
        weightEvidence={unavailable}
        vaccinationEvidence={unavailable}
        nutritionSummary={unavailable}
      />,
    );
    expect(
      screen.getAllByText("Dado de peso não disponível nesta projeção."),
    ).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Partial resilience
// ---------------------------------------------------------------------------

describe("HW-3D — partial resilience", () => {
  it("26. a missing summary still lets canonical restrictions render", () => {
    const c = cockpitOf(null, [restriction("absolute")]);
    render(
      <>
        <HealthCockpitHeader
          dog={c.dog}
          readinessStatus={c.readinessStatus}
          hasValidProjection={false}
          reason={c.reason}
          qualityLabel={c.qualityLabel}
          readinessUpdatedAt={null}
        />
        <CockpitRestrictions restrictions={c.restrictions} coverageComplete />
      </>,
    );

    // Technical state for readiness...
    expect(screen.getAllByText("Sem projeção válida").length).toBeGreaterThan(0);
    // ...while the independent canonical source still renders.
    expect(screen.getByText("Restrição absoluta")).toBeDefined();
  });

  it("27. valid readiness survives a failed restrictions read", () => {
    const c = cockpitOf(summary("operational"));
    render(
      <>
        <HealthCockpitHeader
          dog={c.dog}
          readinessStatus={c.readinessStatus}
          hasValidProjection
          reason={c.reason}
          qualityLabel={c.qualityLabel}
          readinessUpdatedAt={NOW}
        />
        <CockpitRestrictions restrictions={[]} coverageComplete={false} />
      </>,
    );
    expect(screen.getByText("Operacional")).toBeDefined();
    expect(
      screen.getByText(
        "Não foi possível confirmar as restrições ativas com os dados disponíveis.",
      ),
    ).toBeDefined();
  });

  it("28. an unavailable timeline does not hide available preventive evidence", () => {
    const c = cockpitOf(summary("operational", { lastWeight: { kg: 30.1, measuredAt: NOW } }));
    render(
      <>
        <CockpitPreventiveEvidence
          weightEvidence={c.weightEvidence}
          vaccinationEvidence={c.vaccinationEvidence}
          nutritionSummary={c.nutritionSummary}
        />
        <CockpitTimeline timelineSummary={c.timelineSummary} />
      </>,
    );
    expect(screen.getByText("30.1 kg")).toBeDefined();
    expect(screen.getByText(/Histórico: leitura detalhada/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Read-only guarantee across the whole composition
// ---------------------------------------------------------------------------

describe("HW-3D — read-only guarantee", () => {
  it("29. no cockpit section renders a mutation control", () => {
    const c = cockpitOf(
      summary("operational", {
        lastWeight: { kg: 29.8, measuredAt: NOW },
        nutritionPlan: { active: true, foodType: "Ração", amountGrams: 600 },
      }),
      [restriction("partial")],
    );

    render(
      <>
        <CockpitRestrictions restrictions={c.restrictions} coverageComplete />
        <CockpitCompleteness completeness={null} />
        <CockpitPreventiveEvidence
          weightEvidence={c.weightEvidence}
          vaccinationEvidence={c.vaccinationEvidence}
          nutritionSummary={c.nutritionSummary}
        />
        <CockpitClinicalContext
          clinicalSummary={c.clinicalSummary}
          scheduleSummary={c.scheduleSummary}
        />
        <CockpitTimeline timelineSummary={c.timelineSummary} />
      </>,
    );

    // The cockpit is a composition of read models: navigation only, no writes.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("30. restriction identity is shown without exposing a raw storage URL", () => {
    const items: OperationalRestrictionReadModel[] = cockpitOf(
      summary("fit_with_restrictions"),
      [restriction("partial")],
    ).restrictions;

    render(<CockpitRestrictions restrictions={items} coverageComplete />);
    expect(screen.queryByText(/https?:\/\//)).toBeNull();
  });
});
