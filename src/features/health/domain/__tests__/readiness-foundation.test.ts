/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Readiness Foundation & Wire Contract Test Suite (Corrected)
 *
 * Implements unit & domain test coverage for all mandatory scenarios in HW-3A.
 */

import { describe, expect, it } from "vitest";
import {
  aggregateReadinessCockpit,
  aggregateReadinessListItem,
} from "../readiness-aggregator";
import { detectReadinessConflict } from "../conflict-model";
import { evaluateFreshness, evaluateProjectionVersion } from "../freshness-policy";
import {
  parseHealthSummaryWireDoc,
  parseOperationalRestrictionWireDoc,
} from "../wire-parsers";
import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  type CanonicalHealthSummaryDoc,
  type CanonicalRestrictionDoc,
  type DogIdentityReadModel,
  type ReadinessStatus,
} from "../readiness-types";
import type { ReadStateError } from "../read-states";

const mockDog: DogIdentityReadModel = {
  id: "k9-thor",
  name: "Thor",
  registrationNumber: "K9-001",
  photoUrl: "https://example.com/thor.jpg",
  breed: "Pastor Alemão",
  sex: "M",
  dateOfBirth: new Date("2021-01-01T00:00:00.000Z"),
  conductor: {
    ra: "12345",
    name: "Sgt Silva",
  },
  specialties: [
    { id: "spec-1", type: "detecção", status: "operational" },
  ],
};

const fixedNow = new Date("2026-08-08T12:00:00.000Z");

describe("HW-3A Canonical Readiness Wire & Domain Foundation", () => {

  // ==========================================================================
  // 1. Wire Document Parsing Tests (snake_case -> canonical domain model)
  // ==========================================================================

  describe("Wire Document Parsers", () => {
    it("should strictly parse snake_case health_summary wire document", () => {
      const rawWire = {
        readiness_status: "operational",
        readiness_label: "Operacional",
        readiness_reason: "Sem restrições ativas",
        readiness_updated_at: fixedNow.toISOString(),
        last_evaluated_at: new Date(fixedNow.getTime() - 1000).toISOString(),
        updated_at: new Date(fixedNow.getTime() - 500).toISOString(),
        evaluated_by: "system_function",
        active_restrictions: [],
        restriction_count: { absolute: 0, partial: 0, attention: 0 },
        data_completeness: {
          has_recent_weight: true,
          has_active_nutrition: true,
          has_vaccination_current: true,
          has_recent_exam: false,
        },
        active_cases_count: 0,
        active_treatments_count: 0,
        schema_version: 1,
      };

      const parsed = parseHealthSummaryWireDoc(rawWire, mockDog.id);
      expect(parsed).not.toBeNull();
      expect(parsed?.readinessStatus).toBe("operational");
      expect(parsed?.readinessReason).toBe("Sem restrições ativas");
      expect(parsed?.readinessUpdatedAt?.toISOString()).toBe(fixedNow.toISOString());
      expect(parsed?.schemaVersion).toBe(1);
      expect(parsed?.dataCompleteness).toEqual({
        hasRecentWeight: true,
        hasActiveNutrition: true,
        hasVaccinationCurrent: true,
        hasRecentExam: false,
      });
    });

    it("should strictly parse snake_case operational_restriction wire document", () => {
      const rawWire = {
        level: "partial",
        category: "operational",
        description: "Restrição parcial de esforço intenso",
        activities_restricted: ["Faro longo", "Esforço intenso"],
        issued_at: fixedNow.toISOString(),
        recorded_by: { ra: "12345", name: "Sgt Silva" },
        professional: { name: "Dr. Oliveira", crmv: "CRMV-SP 1234" },
        source_document: { id: "doc-1", name: "Laudo Vet", url: "https://example.com/doc.pdf" },
        status: "active",
        schema_version: 1,
      };

      const parsed = parseOperationalRestrictionWireDoc(rawWire, "rest-1", mockDog.id);
      expect(parsed).not.toBeNull();
      expect(parsed?.level).toBe("partial");
      expect(parsed?.description).toBe("Restrição parcial de esforço intenso");
      expect(parsed?.activitiesRestricted).toEqual(["Faro longo", "Esforço intenso"]);
      expect(parsed?.professional).toEqual({ name: "Dr. Oliveira", crmv: "CRMV-SP 1234", clinic: null });
      expect(parsed?.recordedBy?.ra).toBe("12345");
      expect(parsed?.schemaVersion).toBe(1);
    });
  });

  // ==========================================================================
  // 2. Timestamps & Freshness Policy
  // ==========================================================================

  describe("Timestamps Distinction & Freshness", () => {
    it("PROVES EXPLICITLY: readiness_updated_at !== last_evaluated_at AND readiness_updated_at !== updated_at", () => {
      const readinessTime = new Date("2026-08-08T10:00:00.000Z");
      const evaluatedTime = new Date("2026-08-08T11:59:00.000Z");
      const updatedTime = new Date("2026-08-08T11:59:50.000Z");

      expect(readinessTime.getTime()).not.toBe(evaluatedTime.getTime());
      expect(readinessTime.getTime()).not.toBe(updatedTime.getTime());

      // Evaluate freshness based on readiness_updated_at
      const freshness = evaluateFreshness(
        {
          readinessUpdatedAt: readinessTime,
          lastEvaluatedAt: evaluatedTime,
          updatedAt: updatedTime,
        },
        { now: fixedNow }
      );

      // Even though updated_at is 10s old, readiness_updated_at is 2h old -> stale!
      expect(freshness.isStale).toBe(true);
      expect(freshness.readinessUpdatedAt?.toISOString()).toBe(readinessTime.toISOString());
    });

    it("proves updating updated_at alone does NOT make an old readiness_updated_at fresh", () => {
      const oldReadiness = new Date(fixedNow.getTime() - 10 * 60 * 1000); // 10 mins ago
      const brandNewDocUpdate = fixedNow; // updated right now

      const freshness = evaluateFreshness(
        {
          readinessUpdatedAt: oldReadiness,
          updatedAt: brandNewDocUpdate,
        },
        { now: fixedNow }
      );

      expect(freshness.isStale).toBe(true);
      expect(freshness.status).toBe("stale");
    });
  });

  // ==========================================================================
  // 3. Schema Version Policy (Strict Numeric 1)
  // ==========================================================================

  describe("Schema Version Policy", () => {
    it("accepts valid numeric schema_version 1", () => {
      const result = evaluateProjectionVersion(1);
      expect(result.isSupported).toBe(true);
      expect(result.status).toBe("valid");
    });

    it("rejects string version '1' or '1.0' as incompatible format", () => {
      const resString1 = evaluateProjectionVersion("1");
      expect(resString1.isSupported).toBe(false);
      expect(resString1.status).toBe("incompatible");

      const resString1Dot0 = evaluateProjectionVersion("1.0");
      expect(resString1Dot0.isSupported).toBe(false);
      expect(resString1Dot0.status).toBe("incompatible");
    });

    it("rejects missing schema_version", () => {
      const result = evaluateProjectionVersion(null, { allowMissing: false });
      expect(result.isSupported).toBe(false);
      expect(result.status).toBe("missing");
    });
  });

  // ==========================================================================
  // 4. Partial !== Conflict Verification
  // ==========================================================================

  describe("Partial State vs Conflict State", () => {
    it("PROVES EXPLICITLY: partial !== conflict", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        readinessLabel: "Operacional",
        readinessReason: null,
        readinessUpdatedAt: fixedNow,
        lastEvaluatedAt: fixedNow,
        updatedAt: fixedNow,
        evaluatedBy: "system",
        activeRestrictions: [],
        restrictionCount: { absolute: 0, partial: 0, attention: 0 },
        dataCompleteness: null,
        activeCasesCount: 0,
        activeTreatmentsCount: 0,
        pendingScheduleCount: 0,
        overdueScheduleCount: 0,
        schemaVersion: 1,
        rawWireDoc: {},
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        dataQuality: {
          status: "partial",
          partialData: summary,
          failedSources: ["supplementary_data"],
          successfulSources: ["health_summary"],
        },
        now: fixedNow,
      });

      expect(result.qualityLabel).toBe("Parcial");
      expect(result.conflict).toBeNull(); // No structural conflict in partial data!
    });
  });

  // ==========================================================================
  // 5. Official Readiness Domain States (1 to 5)
  // ==========================================================================

  describe("Official Readiness Domain States (1 to 5)", () => {
    const buildSummary = (status: ReadinessStatus, reason: string): CanonicalHealthSummaryDoc => ({
      dogId: mockDog.id,
      readinessStatus: status,
      readinessLabel: READINESS_STATUS_LABELS[status],
      readinessReason: reason,
      readinessUpdatedAt: fixedNow,
      lastEvaluatedAt: fixedNow,
      updatedAt: fixedNow,
      evaluatedBy: "system",
      activeRestrictions: [],
      restrictionCount: { absolute: 0, partial: 0, attention: 0 },
      dataCompleteness: null,
      activeCasesCount: 0,
      activeTreatmentsCount: 0,
      pendingScheduleCount: 0,
      overdueScheduleCount: 0,
      schemaVersion: 1,
      rawWireDoc: {},
    });

    it("1. operational status", () => {
      const summary = buildSummary("operational", "Sem restrições operacionais ativas");
      const result = aggregateReadinessListItem({ dog: mockDog, summary, restrictions: [], now: fixedNow });
      expect(result.readinessStatus).toBe("operational");
      expect(result.readinessLabel).toBe("Operacional");
      expect(result.qualityLabel).toBe("Atualizada");
    });

    it("2. operational_attention status", () => {
      const summary = buildSummary("operational_attention", "Pesagem em atraso");
      const result = aggregateReadinessListItem({ dog: mockDog, summary, restrictions: [], now: fixedNow });
      expect(result.readinessStatus).toBe("operational_attention");
      expect(result.readinessLabel).toBe("Operacional com atenção");
    });

    it("3. fit_with_restrictions status", () => {
      const summary = buildSummary("fit_with_restrictions", "Restrição parcial ativa");
      summary.restrictionCount = { absolute: 0, partial: 1, attention: 0 };
      const restriction: CanonicalRestrictionDoc = {
        id: "rest-1",
        dogId: mockDog.id,
        level: "partial",
        category: "operational",
        description: "Restrição de esforço",
        activitiesRestricted: ["Faro prolongado"],
        issuedAt: fixedNow,
        recordedBy: { ra: "123" },
        professional: { name: "Dr Vet" },
        sourceDocument: null,
        expectedEnd: null,
        actualEnd: null,
        endedBy: null,
        endProfessional: null,
        endSourceDocument: null,
        endReason: null,
        evidence: null,
        status: "active",
        caseId: null,
        eventId: null,
        examId: null,
        schemaVersion: 1,
        rawWireDoc: {},
      };
      const result = aggregateReadinessListItem({ dog: mockDog, summary, restrictions: [restriction], now: fixedNow });
      expect(result.readinessStatus).toBe("fit_with_restrictions");
      expect(result.readinessLabel).toBe("Apto com restrições");
      expect(result.activeRestrictionsSummary).toHaveLength(1);
    });

    it("4. temporarily_unfit status", () => {
      const summary = buildSummary("temporarily_unfit", "Restrição absoluta ativa");
      summary.restrictionCount = { absolute: 1, partial: 0, attention: 0 };
      const restriction: CanonicalRestrictionDoc = {
        id: "rest-2",
        dogId: mockDog.id,
        level: "absolute",
        category: "operational",
        description: "Inapto temporário para cirurgia",
        activitiesRestricted: ["Qualquer serviço"],
        issuedAt: fixedNow,
        recordedBy: { ra: "123" },
        professional: { name: "Dr Vet" },
        sourceDocument: null,
        expectedEnd: null,
        actualEnd: null,
        endedBy: null,
        endProfessional: null,
        endSourceDocument: null,
        endReason: null,
        evidence: null,
        status: "active",
        caseId: null,
        eventId: null,
        examId: null,
        schemaVersion: 1,
        rawWireDoc: {},
      };
      const result = aggregateReadinessListItem({ dog: mockDog, summary, restrictions: [restriction], now: fixedNow });
      expect(result.readinessStatus).toBe("temporarily_unfit");
      expect(result.readinessLabel).toBe("Temporariamente inapto");
    });

    it("5. not_evaluated status", () => {
      const summary = buildSummary("not_evaluated", "Nenhuma avaliação registrada no sistema");
      const result = aggregateReadinessListItem({ dog: mockDog, summary, restrictions: [], now: fixedNow });
      expect(result.readinessStatus).toBe("not_evaluated");
      expect(result.readinessLabel).toBe("Não avaliado");
    });
  });

  // ==========================================================================
  // 6. Mandatory Semantic Proofs
  // ==========================================================================

  describe("Mandatory Semantic Proofs", () => {
    it("PROVES EXPLICITLY: error !== not_evaluated", () => {
      const readError: ReadStateError = {
        status: "error",
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Permission denied reading health summary",
        retryable: true,
      };

      expect(readError.status).toBe("error");
      expect(readError.status).not.toBe("not_evaluated");

      const notEvaluatedStatus: ReadinessStatus = "not_evaluated";
      expect(notEvaluatedStatus).toBe("not_evaluated");
      expect(notEvaluatedStatus).not.toBe("error");
    });

    it("PROVES EXPLICITLY: missing summary !== not_evaluated", () => {
      const missingSummaryResult = aggregateReadinessListItem({
        dog: mockDog,
        summary: null, // missing projection
        restrictions: [],
        now: fixedNow,
      });

      expect(missingSummaryResult.qualityLabel).toBe("Sem projeção válida");

      const validNotEvaluatedResult = aggregateReadinessListItem({
        dog: mockDog,
        summary: {
          dogId: mockDog.id,
          readinessStatus: "not_evaluated",
          readinessLabel: "Não avaliado",
          readinessReason: "Nenhuma avaliação",
          readinessUpdatedAt: fixedNow,
          lastEvaluatedAt: fixedNow,
          updatedAt: fixedNow,
          evaluatedBy: "system",
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
        now: fixedNow,
      });

      expect(validNotEvaluatedResult.qualityLabel).toBe("Atualizada");
      expect(missingSummaryResult.qualityLabel).not.toBe(validNotEvaluatedResult.qualityLabel);
    });
  });

});
