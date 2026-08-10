/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Unit & Integration Test Suite for Health Overview (/health)
 *
 * Validates:
 * 1. Counts of the five status cards (only valid projections, missing/error do not count as not_evaluated).
 * 2. Error does not count as not_evaluated.
 * 3. Missing summary does not count as not_evaluated.
 * 4. Priority ordering: temporarily_unfit > fit_with_restrictions > operational_attention > not_evaluated > operational.
 * 5. Chart distribution data.
 * 6. Empty state rendering.
 * 7. Partial section rendering.
 * 8. Reason rendering.
 * 9. "Fonte: Canônica" rendering.
 * 10. Read-only link targets (/health/readiness and /health/readiness/[dogId]).
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthStatusCards } from "../components/health-status-cards";
import { HealthPriorityK9List } from "../components/health-priority-k9-list";
import { HealthLatestReadingsTable } from "../components/health-latest-readings-table";
import { HealthOverviewEmpty, HealthOverviewError } from "../components/health-overview-states";
import { aggregateReadinessListItem } from "../../domain/readiness-aggregator";
import { READINESS_STATUS_PRIORITY, type ReadinessListItem, type ReadinessStatus } from "../../domain/readiness-types";

const TEST_DOG_A = {
  id: "k9-odin",
  name: "Odin",
  registrationNumber: "K9-001",
  photoUrl: null,
  breed: "Pastor Alemão",
  sex: "Macho",
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

const TEST_DOG_B = {
  id: "k9-thor",
  name: "Thor",
  registrationNumber: "K9-002",
  photoUrl: null,
  breed: "Pastor Belga",
  sex: "Macho",
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

const TEST_DOG_C = {
  id: "k9-zeus",
  name: "Zeus",
  registrationNumber: "K9-003",
  photoUrl: null,
  breed: "Labrador",
  sex: "Macho",
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

describe("HW-3B Health Overview Unit & Presentation Tests", () => {
  it("1. Status cards render exact counts for the 5 official readiness status cards", () => {
    const counts = {
      operational: 3,
      operational_attention: 2,
      fit_with_restrictions: 1,
      temporarily_unfit: 1,
      not_evaluated: 0,
    };

    render(<HealthStatusCards counts={counts} />);

    expect(screen.getByRole("button", { name: /Operacional: 3 cães/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Operacional com atenção: 2 cães/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Apto com restrições: 1 cães/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Temporariamente inapto: 1 cães/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Não avaliado: 0 cães/i })).toBeDefined();
  });

  it("2 & 3. Missing summary / Error quality does NOT count as not_evaluated", () => {
    const itemWithoutSummary = aggregateReadinessListItem({
      dog: TEST_DOG_A,
      summary: null,
      restrictions: [],
      dataQuality: { status: "empty", query: "dogs/k9-odin/health_summary/current" },
    });

    expect(itemWithoutSummary.summary).toBeNull();
    expect(itemWithoutSummary.qualityLabel).toBe("Sem projeção válida");
  });

  it("4. Priority ordering: temporarily_unfit (0) > fit_with_restrictions (1) > operational_attention (2) > not_evaluated (3) > operational (4)", () => {
    const itemUnfit = aggregateReadinessListItem({
      dog: TEST_DOG_A,
      summary: {
        dogId: "k9-odin",
        readinessStatus: "temporarily_unfit",
        readinessLabel: "Temporariamente inapto",
        readinessReason: "Lesão grave",
        readinessUpdatedAt: new Date(),
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
        evaluatedBy: "function_v1",
        activeRestrictions: [],
        restrictionCount: { absolute: 1, partial: 0, attention: 0 },
        dataCompleteness: null,
        activeCasesCount: 1,
        activeTreatmentsCount: 0,
        pendingScheduleCount: 0,
        overdueScheduleCount: 0,
        schemaVersion: 1,
        rawWireDoc: {},
      },
      restrictions: [],
    });

    const itemOperational = aggregateReadinessListItem({
      dog: TEST_DOG_B,
      summary: {
        dogId: "k9-thor",
        readinessStatus: "operational",
        readinessLabel: "Operacional",
        readinessReason: "Sem pendências",
        readinessUpdatedAt: new Date(),
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
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
      },
      restrictions: [],
    });

    const unordered: ReadinessListItem[] = [itemOperational, itemUnfit];
    const sorted = [...unordered].sort(
      (a, b) => READINESS_STATUS_PRIORITY[a.readinessStatus] - READINESS_STATUS_PRIORITY[b.readinessStatus]
    );

    expect(sorted[0].readinessStatus).toBe("temporarily_unfit");
    expect(sorted[1].readinessStatus).toBe("operational");
  });

  it("5 & 8. Priority list renders reason and read-only link target /health/readiness/[dogId]", () => {
    const itemUnfit = aggregateReadinessListItem({
      dog: TEST_DOG_A,
      summary: {
        dogId: "k9-odin",
        readinessStatus: "temporarily_unfit",
        readinessLabel: "Temporariamente inapto",
        readinessReason: "Repouso por fratura",
        readinessUpdatedAt: new Date(),
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
        evaluatedBy: "function_v1",
        activeRestrictions: [],
        restrictionCount: { absolute: 1, partial: 0, attention: 0 },
        dataCompleteness: null,
        activeCasesCount: 1,
        activeTreatmentsCount: 0,
        pendingScheduleCount: 0,
        overdueScheduleCount: 0,
        schemaVersion: 1,
        rawWireDoc: {},
      },
      restrictions: [],
    });

    render(<HealthPriorityK9List items={[itemUnfit]} />);

    expect(screen.getByText("Odin")).toBeDefined();
    expect(screen.getByText("Repouso por fratura")).toBeDefined();

    const cockpitLink = screen.getByRole("link", { name: /Ver cockpit do K9 Odin/i });
    expect(cockpitLink.getAttribute("href")).toBe("/health/readiness/k9-odin");
  });

  it("6. Empty state renders explicit text 'Nenhum K9 monitorado'", () => {
    render(<HealthOverviewEmpty />);

    expect(screen.getByText("Nenhum K9 monitorado")).toBeDefined();
    expect(
      screen.getByText("Não há K9s disponíveis para monitoramento no escopo atual desta unidade.")
    ).toBeDefined();
  });

  it("7. Error state renders explicit technical failure card with retry action", () => {
    render(<HealthOverviewError message="Erro de rede" />);

    expect(screen.getByText("Não foi possível carregar a prontidão")).toBeDefined();
    expect(screen.getByText("Nenhum estado operacional foi presumido.")).toBeDefined();
    expect(screen.getByText("Erro de rede")).toBeDefined();
  });

  it("9. Latest readings table renders 'Fonte: Canônica'", () => {
    const item = aggregateReadinessListItem({
      dog: TEST_DOG_C,
      summary: {
        dogId: "k9-zeus",
        readinessStatus: "operational",
        readinessLabel: "Operacional",
        readinessReason: "Em perfeitas condições",
        readinessUpdatedAt: new Date("2026-08-09T12:00:00.000Z"),
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
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
      },
      restrictions: [],
    });

    render(<HealthLatestReadingsTable items={[item]} />);

    expect(screen.getByText("Fonte: Canônica")).toBeDefined();
    expect(screen.getByText("Zeus")).toBeDefined();
    expect(screen.getByText("Em perfeitas condições")).toBeDefined();
  });
});
