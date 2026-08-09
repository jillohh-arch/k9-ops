/**
 * WEIGHT-01D-C2A — asserções semânticas de peso na página Health.
 *
 * A página distingue ausência real de pesagem (`none`) de peso não conclusivo
 * (`inconclusive`). Não deve afirmar "sem registro" nem exibir valor antigo
 * quando a coleção está bloqueada por integridade.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HealthData, HealthDogSummary } from "@/features/health/hooks/use-health-data";

const healthData = vi.hoisted(() => ({
  current: null as HealthData | null,
}));

vi.mock("@/features/health/hooks/use-health-data", () => ({
  useHealthData: () => healthData.current,
}));
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: () => false }),
}));
vi.mock("@/features/dashboard/providers/dashboard-period-provider", () => ({
  useDashboardPeriod: () => ({ periodDays: 30, periodLabel: "30 dias" }),
}));
vi.mock("@/features/health/components/health-event-hub", () => ({
  HealthEventHub: () => null,
}));

import HealthPage from "../page";

function dogSummary(overrides: Partial<HealthDogSummary>): HealthDogSummary {
  return {
    documentsCount: 0,
    dogId: "dog-fixture",
    dogName: "Apolo Fixture",
    eventsCount: 0,
    exam: "current",
    idealRange: { max: 35, min: 30 },
    issues: [],
    latestExamAt: new Date("2026-07-01T00:00:00.000Z"),
    latestVaccineAt: new Date("2026-07-01T00:00:00.000Z"),
    latestVaccineDueAt: new Date("2027-07-01T00:00:00.000Z"),
    latestWeightAt: null,
    latestWeightKg: null,
    photoUrl: null,
    ready: false,
    status: "Ativo",
    vaccine: "current",
    weight: "missing",
    weightCurrentState: "none",
    ...overrides,
  };
}

function healthDataFor(dog: HealthDogSummary): HealthData {
  return {
    attention: dog.issues.length > 0 ? [dog] : [],
    documents: [],
    dogs: [dog],
    errors: [],
    loading: false,
    metrics: {
      critical: 0,
      documents: 0,
      examsDue: 0,
      incomplete: 1,
      periodEvents: 0,
      ready: 0,
      readyPercent: 0,
      total: 1,
      vaccinesDueSoon: 0,
      vaccinesOverdue: 0,
      weightAttention: 0,
    },
    recentEvents: [],
    upcoming: [],
  };
}

function renderWith(dog: HealthDogSummary) {
  healthData.current = healthDataFor(dog);
  return render(<HealthPage />);
}

describe("peso não conclusivo na página Health", () => {
  it("não afirma ausência de pesagem quando o estado é inconclusive", () => {
    renderWith(
      dogSummary({
        issues: [
          {
            detail: "registro de pesagem inconsistente; revisar weight_records",
            label: "Peso não conclusivo",
            severity: "warning",
          },
        ],
        weightCurrentState: "inconclusive",
      }),
    );

    expect(screen.queryByText("Sem pesagem")).not.toBeInTheDocument();
    expect(screen.getAllByText("Não conclusivo").length).toBeGreaterThan(0);
  });

  it("mantém a afirmação de ausência quando não há registro algum", () => {
    renderWith(dogSummary({ weightCurrentState: "none" }));

    expect(screen.getAllByText("Sem pesagem").length).toBeGreaterThan(0);
    expect(screen.queryByText("Não conclusivo")).not.toBeInTheDocument();
  });

  it("não exibe valor de peso quando o estado é inconclusive", () => {
    renderWith(
      dogSummary({
        latestWeightAt: null,
        latestWeightKg: null,
        weightCurrentState: "inconclusive",
      }),
    );

    expect(screen.queryByText(/33,3 kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/32,0 kg/)).not.toBeInTheDocument();
  });

  it("exibe o peso factual quando o estado é current", () => {
    renderWith(
      dogSummary({
        latestWeightAt: new Date("2026-08-06T10:00:00.000Z"),
        latestWeightKg: 33.3,
        weight: "in_range",
        weightCurrentState: "current",
      }),
    );

    expect(screen.getAllByText(/33,3 kg/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Não conclusivo")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem pesagem")).not.toBeInTheDocument();
  });
});
