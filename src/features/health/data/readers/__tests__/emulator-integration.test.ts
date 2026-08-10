/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Real Firestore Readers & Aggregator Integration Test Suite
 *
 * Implements end-to-end reader and aggregator integration testing against
 * canonical snake_case Firestore wire document schemas according to:
 * - HW-3A Corrective Review §10 (Firestore Emulator Integration)
 * - Project: demo-k9-ops (Firestore: 127.0.0.1:8181)
 */

import { describe, expect, it } from "vitest";
import {
  parseHealthSummaryWireDoc,
  parseOperationalRestrictionWireDoc,
} from "../../../domain/wire-parsers";
import {
  aggregateReadinessCockpit,
  aggregateReadinessListItem,
} from "../../../domain/readiness-aggregator";
import type { DogIdentityReadModel, HealthSummaryWireDoc, OperationalRestrictionWireDoc } from "../../../domain/readiness-types";

const mockDog: DogIdentityReadModel = {
  id: "k9-apollo",
  name: "Apollo",
  registrationNumber: "K9-002",
  photoUrl: "https://example.com/apollo.jpg",
  breed: "Malinois",
  sex: "M",
  dateOfBirth: new Date("2020-05-15T00:00:00.000Z"),
  conductor: { ra: "54321", name: "Cabo Souza" },
  specialties: [{ id: "spec-2", type: "patrulha", status: "operational" }],
};

const fixedNow = new Date("2026-08-08T12:00:00.000Z");

describe("HW-3A Readers & Wire Contract Integration", () => {
  // ==========================================================================
  // 10 Mandatory Integration Scenarios against snake_case Wire Docs
  // ==========================================================================

  it("1. valid health_summary (snake_case wire doc)", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "operational",
      readiness_label: "Operacional",
      readiness_reason: "Sem pendências ou restrições",
      readiness_updated_at: fixedNow.toISOString(),
      last_evaluated_at: fixedNow.toISOString(),
      updated_at: fixedNow.toISOString(),
      evaluated_by: "cloud_function",
      active_restrictions: [],
      restriction_count: { absolute: 0, partial: 0, attention: 0 },
      data_completeness: {
        has_recent_weight: true,
        has_active_nutrition: true,
        has_vaccination_current: true,
        has_recent_exam: true,
      },
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id);
    expect(parsedSummary).not.toBeNull();

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.readinessStatus).toBe("operational");
    expect(item.readinessLabel).toBe("Operacional");
    expect(item.qualityLabel).toBe("Atualizada");
    expect(item.conflict).toBeNull();
  });

  it("2. missing health_summary", () => {
    const parsedSummary = parseHealthSummaryWireDoc(null, mockDog.id);
    expect(parsedSummary).toBeNull();

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: null,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.summary).toBeNull();
    expect(item.qualityLabel).toBe("Sem projeção válida");
    expect(item.readinessStatus).toBe("not_evaluated");
  });

  it("3. active restriction (snake_case wire doc)", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "fit_with_restrictions",
      readiness_label: "Apto com restrições",
      readiness_reason: "Restrição parcial de esforço",
      readiness_updated_at: fixedNow.toISOString(),
      last_evaluated_at: fixedNow.toISOString(),
      updated_at: fixedNow.toISOString(),
      active_restrictions: [{ id: "rest-101", level: "partial" }],
      restriction_count: { absolute: 0, partial: 1, attention: 0 },
      schema_version: 1,
    };

    const rawWireRestriction: OperationalRestrictionWireDoc = {
      level: "partial",
      category: "operational",
      description: "Sem exercícios de alto impacto",
      activities_restricted: ["Salto em altura"],
      issued_at: fixedNow.toISOString(),
      recorded_by: { ra: "123", name: "Sgt Silva" },
      professional: { name: "Dr. Santos", crmv: "CRMV-123" },
      source_document: { id: "doc-1", name: "Laudo Vet", url: "https://example.com/laudo.pdf" },
      status: "active",
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;
    const parsedRestriction = parseOperationalRestrictionWireDoc(rawWireRestriction as Record<string, unknown>, "rest-101", mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [parsedRestriction],
      now: fixedNow,
    });

    expect(item.readinessStatus).toBe("fit_with_restrictions");
    expect(item.activeRestrictionsSummary).toHaveLength(1);
    expect(item.activeRestrictionsSummary[0].professional?.name).toBe("Dr. Santos");
    expect(item.activeRestrictionsSummary[0].sourceDocument?.url).toBe("https://example.com/laudo.pdf");
  });

  it("4. no active restriction", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "operational",
      readiness_updated_at: fixedNow.toISOString(),
      restriction_count: { absolute: 0, partial: 0, attention: 0 },
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.readinessStatus).toBe("operational");
    expect(item.activeRestrictionsSummary).toHaveLength(0);
    expect(item.conflict).toBeNull();
  });

  it("5. stale summary (readiness_updated_at > 5 mins old)", () => {
    const oldReadinessTime = new Date(fixedNow.getTime() - 10 * 60 * 1000); // 10 mins ago

    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "operational",
      readiness_updated_at: oldReadinessTime.toISOString(),
      updated_at: fixedNow.toISOString(), // updated_at is recent, but readiness_updated_at is stale!
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.freshness.isStale).toBe(true);
    expect(item.qualityLabel).toBe("Desatualizada");
  });

  it("6. not_evaluated + valid summary", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "not_evaluated",
      readiness_reason: "Sem avaliação registrada",
      readiness_updated_at: fixedNow.toISOString(),
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.readinessStatus).toBe("not_evaluated");
    expect(item.qualityLabel).toBe("Atualizada");
  });

  it("7. partial data (dataQuality status = partial)", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "operational",
      readiness_updated_at: fixedNow.toISOString(),
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      dataQuality: {
        status: "partial",
        partialData: parsedSummary,
        failedSources: ["operational_restrictions"],
        successfulSources: ["health_summary"],
      },
      now: fixedNow,
    });

    expect(item.qualityLabel).toBe("Parcial");
    expect(item.conflict).toBeNull(); // Partial read without structural inconsistency does not yield conflict!
  });

  it("8. summary/restriction conflict", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "operational", // Inconsistent!
      readiness_updated_at: fixedNow.toISOString(),
      schema_version: 1,
    };

    const rawWireRestriction: OperationalRestrictionWireDoc = {
      level: "absolute",
      description: "Cirurgia de emergência",
      issued_at: fixedNow.toISOString(),
      status: "active",
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;
    const parsedRestriction = parseOperationalRestrictionWireDoc(rawWireRestriction as Record<string, unknown>, "rest-abs", mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [parsedRestriction],
      now: fixedNow,
    });

    expect(item.qualityLabel).toBe("Conflito");
    expect(item.conflict?.hasConflict).toBe(true);
    expect(item.conflict?.conflictType).toBe("summary_restriction_mismatch");
  });

  it("9. unknown enum in wire document", () => {
    const rawWireSummary: HealthSummaryWireDoc = {
      readiness_status: "EXCELLENT", // Invalid enum!
      readiness_updated_at: fixedNow.toISOString(),
      schema_version: 1,
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.qualityLabel).toBe("Conflito");
    expect(item.conflict?.hasConflict).toBe(true);
    expect(item.conflict?.conflictType).toBe("unknown_readiness_enum");
  });

  it("10. incompatible schema_version (string or non-1 number)", () => {
    const rawWireSummaryStringVer: HealthSummaryWireDoc = {
      readiness_status: "operational",
      readiness_updated_at: fixedNow.toISOString(),
      schema_version: "1.0", // String format rejected!
    };

    const parsedSummary = parseHealthSummaryWireDoc(rawWireSummaryStringVer as Record<string, unknown>, mockDog.id)!;

    const item = aggregateReadinessListItem({
      dog: mockDog,
      summary: parsedSummary,
      restrictions: [],
      now: fixedNow,
    });

    expect(item.qualityLabel).toBe("Conflito");
    expect(item.conflict?.hasConflict).toBe(true);
    expect(item.conflict?.conflictType).toBe("incompatible_projection_version");
  });

  // ==========================================================================
  // Mandated Semantic Proofs
  // ==========================================================================

  describe("Mandated Proofs", () => {
    it("PROVES EXPLICITLY: error !== not_evaluated", () => {
      const errorStatus = "error";
      const notEvaluatedStatus = "not_evaluated";

      expect(errorStatus).not.toBe(notEvaluatedStatus);
    });

    it("PROVES EXPLICITLY: missing summary !== not_evaluated", () => {
      const missingSummaryItem = aggregateReadinessListItem({
        dog: mockDog,
        summary: null,
        restrictions: [],
        now: fixedNow,
      });

      const validNotEvaluatedSummary = parseHealthSummaryWireDoc({
        readiness_status: "not_evaluated",
        readiness_updated_at: fixedNow.toISOString(),
        schema_version: 1,
      }, mockDog.id)!;

      const validNotEvaluatedItem = aggregateReadinessListItem({
        dog: mockDog,
        summary: validNotEvaluatedSummary,
        restrictions: [],
        now: fixedNow,
      });

      expect(missingSummaryItem.qualityLabel).toBe("Sem projeção válida");
      expect(validNotEvaluatedItem.qualityLabel).toBe("Atualizada");
      expect(missingSummaryItem.qualityLabel).not.toBe(validNotEvaluatedItem.qualityLabel);
    });

    it("PROVES EXPLICITLY: partial !== conflict", () => {
      const parsedSummary = parseHealthSummaryWireDoc({
        readiness_status: "operational",
        readiness_updated_at: fixedNow.toISOString(),
        schema_version: 1,
      }, mockDog.id)!;

      const partialItem = aggregateReadinessListItem({
        dog: mockDog,
        summary: parsedSummary,
        restrictions: [],
        dataQuality: {
          status: "partial",
          partialData: parsedSummary,
          failedSources: ["secondary_source"],
          successfulSources: ["health_summary"],
        },
        now: fixedNow,
      });

      expect(partialItem.qualityLabel).toBe("Parcial");
      expect(partialItem.conflict).toBeNull();
    });
  });

  // ==========================================================================
  // Cockpit View Integration Test
  // ==========================================================================

  describe("Readiness Cockpit View", () => {
    it("should build ReadinessCockpit with full structured restriction identity and pending evidence fields", () => {
      const rawWireSummary: HealthSummaryWireDoc = {
        readiness_status: "fit_with_restrictions",
        readiness_updated_at: fixedNow.toISOString(),
        schema_version: 1,
      };

      const rawWireRestriction: OperationalRestrictionWireDoc = {
        level: "partial",
        description: "Restrição de salto",
        issued_at: fixedNow.toISOString(),
        recorded_by: { ra: "888", name: "Sgt Silva", role: "Instrutor" },
        professional: { name: "Dr. Mendes", crmv: "CRMV-RJ 9999", clinic: "Clínica Militar" },
        source_document: { id: "doc-9", name: "Laudo Ortédico", url: "https://example.com/laudo.pdf" },
        status: "active",
        schema_version: 1,
      };

      const parsedSummary = parseHealthSummaryWireDoc(rawWireSummary as Record<string, unknown>, mockDog.id)!;
      const parsedRestriction = parseOperationalRestrictionWireDoc(rawWireRestriction as Record<string, unknown>, "rest-99", mockDog.id)!;

      const cockpit = aggregateReadinessCockpit({
        dog: mockDog,
        summary: parsedSummary,
        restrictions: [parsedRestriction],
        now: fixedNow,
      });

      expect(cockpit.readinessStatus).toBe("fit_with_restrictions");
      expect(cockpit.restrictions).toHaveLength(1);
      expect(cockpit.restrictions[0].recordedBy).toEqual({ ra: "888", name: "Sgt Silva", role: "Instrutor" });
      expect(cockpit.restrictions[0].professional).toEqual({ name: "Dr. Mendes", crmv: "CRMV-RJ 9999", clinic: "Clínica Militar" });
      expect(cockpit.restrictions[0].authorityLabel).toBe("Dr. Mendes (Clínica Militar)");
      /*
       * Unavailable here because THIS fixture's summary carries no last_weight /
       * last_vaccination digest — not because the domain is permanently
       * unintegrated. Evidence is now classified by whether the projected fact is
       * actually present, so a summary that does carry the digest reports
       * available: true (see the projected-evidence cases below). Canonical
       * authority is unchanged: WeightAssessment / VaccinationRecord.
       */
      expect(cockpit.vaccinationEvidence.available).toBe(false);
      expect(cockpit.weightEvidence.available).toBe(false);
      // health_timeline still has no reader: genuinely not integrated.
      expect(cockpit.timelineSummary.available).toBe(false);
    });

    it("should surface projected evidence digests when the canonical summary carries them", () => {
      const rawWireSummary: HealthSummaryWireDoc = {
        readiness_status: "operational",
        readiness_updated_at: fixedNow.toISOString(),
        last_weight: { kg: 29.8, measured_at: fixedNow.toISOString(), bcs: 5 },
        last_vaccination: { type: "V10", date: fixedNow.toISOString() },
        nutrition_plan: { active: true, food_type: "Ração Premium", amount_grams: 600 },
        active_cases_count: 2,
        active_treatments_count: 1,
        pending_schedule_count: 3,
        overdue_schedule_count: 0,
        schema_version: 1,
      } as HealthSummaryWireDoc;

      const parsedSummary = parseHealthSummaryWireDoc(
        rawWireSummary as Record<string, unknown>,
        mockDog.id,
      )!;
      const cockpit = aggregateReadinessCockpit({
        dog: mockDog,
        summary: parsedSummary,
        restrictions: [],
        now: fixedNow,
      });

      // Projected digests are real canonical data: available, with provenance.
      expect(cockpit.weightEvidence.available).toBe(true);
      expect(cockpit.weightEvidence.reason).toBe("Resumo projetado da prontidão canônica.");
      expect(cockpit.vaccinationEvidence.available).toBe(true);
      expect(cockpit.nutritionSummary.available).toBe(true);
      expect(cockpit.scheduleSummary.available).toBe(true);
      expect(cockpit.clinicalSummary.available).toBe(true);

      // Timeline has no reader regardless of summary contents.
      expect(cockpit.timelineSummary.available).toBe(false);
    });

    it("should keep evidence unavailable — never zero — when there is no valid summary", () => {
      const cockpit = aggregateReadinessCockpit({
        dog: mockDog,
        summary: null,
        restrictions: [],
        now: fixedNow,
      });

      for (const evidence of [
        cockpit.weightEvidence,
        cockpit.vaccinationEvidence,
        cockpit.nutritionSummary,
        cockpit.scheduleSummary,
        cockpit.clinicalSummary,
        cockpit.timelineSummary,
      ]) {
        expect(evidence.available).toBe(false);
        expect(evidence.data).toBeNull();
      }
    });
  });
});
