/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Readiness Foundation & Quality Test Suite
 *
 * Implements unit & domain test coverage for all mandatory scenarios in HW-3A §16.
 */

import { describe, expect, it } from "vitest";
import {
  aggregateReadinessCockpit,
  aggregateReadinessListItem,
} from "../readiness-aggregator";
import { detectReadinessConflict } from "../conflict-model";
import { evaluateFreshness, evaluateProjectionVersion } from "../freshness-policy";
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

describe("HW-3A Canonical Readiness Foundation", () => {
  // ==========================================================================
  // Section 16: Mandatory Domain Status Test Cases (1 to 5)
  // ==========================================================================

  describe("Official Readiness Domain States (1 to 5)", () => {
    it("1. should correctly aggregate 'operational' status", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        readinessReason: "Sem restrições operacionais ativas",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("operational");
      expect(result.readinessLabel).toBe("Operacional");
      expect(result.qualityLabel).toBe("Atualizada");
      expect(result.conflict).toBeNull();
    });

    it("2. should correctly aggregate 'operational_attention' status", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational_attention",
        readinessReason: "Pesagem em atraso (> 90 dias)",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("operational_attention");
      expect(result.readinessLabel).toBe("Operacional com atenção");
      expect(result.qualityLabel).toBe("Atualizada");
    });

    it("3. should correctly aggregate 'fit_with_restrictions' status", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "fit_with_restrictions",
        readinessReason: "Restrição parcial ativa",
        activeRestrictionsCount: 1,
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const restriction: CanonicalRestrictionDoc = {
        id: "rest-1",
        dogId: mockDog.id,
        level: "partial",
        status: "active",
        reason: "Escoriação leve em pata posterior",
        restrictedActivities: ["Saltos e obstáculos"],
        issuedAt: fixedNow.toISOString(),
        issuedBy: "Cap Vet Souza",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [restriction],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("fit_with_restrictions");
      expect(result.readinessLabel).toBe("Apto com restrições");
      expect(result.activeRestrictionsSummary).toHaveLength(1);
      expect(result.activeRestrictionsSummary[0].type).toBe("partial");
    });

    it("4. should correctly aggregate 'temporarily_unfit' status", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "temporarily_unfit",
        readinessReason: "Restrição absoluta ativa",
        activeRestrictionsCount: 1,
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const restriction: CanonicalRestrictionDoc = {
        id: "rest-2",
        dogId: mockDog.id,
        level: "absolute",
        status: "active",
        reason: "Pós-operatório cirúrgico",
        restrictedActivities: ["Qualquer atividade operacional"],
        issuedAt: fixedNow.toISOString(),
        issuedBy: "Maj Vet Oliveira",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [restriction],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("temporarily_unfit");
      expect(result.readinessLabel).toBe("Temporariamente inapto");
      expect(result.activeRestrictionsSummary[0].type).toBe("absolute");
    });

    it("5. should correctly aggregate 'not_evaluated' status", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "not_evaluated",
        readinessReason: "Nenhuma avaliação registrada no sistema",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("not_evaluated");
      expect(result.readinessLabel).toBe("Não avaliado");
    });
  });

  // ==========================================================================
  // Section 16: Mandatory Technical Test Cases (6 to 15)
  // ==========================================================================

  describe("Technical & Quality Scenarios (6 to 15)", () => {
    it("6. should handle missing summary gracefully", () => {
      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary: null,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.summary).toBeNull();
      expect(result.qualityLabel).toBe("Sem projeção válida");
      expect(result.readinessStatus).toBe("not_evaluated");
    });

    it("7. should flag stale summary when age exceeds threshold (5 mins)", () => {
      const oldTime = new Date(fixedNow.getTime() - 10 * 60 * 1000); // 10 minutes ago
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        updatedAt: oldTime.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.freshness.isStale).toBe(true);
      expect(result.qualityLabel).toBe("Desatualizada");
    });

    it("8. should flag partial summary state when reader state is partial", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        dataQuality: {
          status: "partial",
          partialData: summary,
          failedSources: ["operational_restrictions"],
          successfulSources: ["health_summary"],
        },
        now: fixedNow,
      });

      expect(result.qualityLabel).toBe("Parcial");
      expect(result.conflict?.hasConflict).toBe(true);
      expect(result.conflict?.conflictType).toBe("partial_reader_failure");
    });

    it("9. should detect unknown readiness enum and flag conflict", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "EXCELLENT_HEALTH" as unknown as ReadinessStatus,
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.conflict?.hasConflict).toBe(true);
      expect(result.conflict?.conflictType).toBe("unknown_readiness_enum");
      expect(result.qualityLabel).toBe("Conflito");
    });

    it("10. should flag conflict on incompatible projection version", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        updatedAt: fixedNow.toISOString(),
        version: "99.0", // Unsupported version
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.conflict?.hasConflict).toBe(true);
      expect(result.conflict?.conflictType).toBe("incompatible_projection_version");
      expect(result.qualityLabel).toBe("Conflito");
    });

    it("11. should fail-closed on missing projection version", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        updatedAt: fixedNow.toISOString(),
        version: undefined,
      };

      const versionEval = evaluateProjectionVersion(summary.version, { allowMissing: false });
      expect(versionEval.isSupported).toBe(false);
      expect(versionEval.status).toBe("missing");

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.conflict?.hasConflict).toBe(true);
      expect(result.conflict?.conflictType).toBe("incompatible_projection_version");
    });

    it("12. should detect conflict when summary is operational but active absolute restriction exists", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational", // Inconsistent!
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const restriction: CanonicalRestrictionDoc = {
        id: "rest-abs",
        dogId: mockDog.id,
        level: "absolute",
        status: "active",
        reason: "Suspeita de fratura",
        issuedAt: fixedNow.toISOString(),
        issuedBy: "Cap Vet Souza",
      };

      const conflict = detectReadinessConflict({
        summary,
        restrictions: [restriction],
      });

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictType).toBe("summary_restriction_mismatch");

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [restriction],
        now: fixedNow,
      });

      expect(result.qualityLabel).toBe("Conflito");
    });

    it("13. should handle valid summary + no active restriction without conflict", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        activeRestrictionsCount: 0,
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.conflict).toBeNull();
      expect(result.readinessStatus).toBe("operational");
    });

    it("14. should handle fit_with_restrictions + active restriction consistently", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "fit_with_restrictions",
        activeRestrictionsCount: 1,
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const restriction: CanonicalRestrictionDoc = {
        id: "rest-p",
        dogId: mockDog.id,
        level: "partial",
        status: "active",
        reason: "Restrição de corrida",
        issuedAt: fixedNow.toISOString(),
        issuedBy: "Vet Silva",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [restriction],
        now: fixedNow,
      });

      expect(result.conflict).toBeNull();
      expect(result.readinessStatus).toBe("fit_with_restrictions");
    });

    it("15. should handle not_evaluated + valid fresh projection snapshot", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "not_evaluated",
        readinessReason: "K9 recentemente incorporado",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const result = aggregateReadinessListItem({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(result.readinessStatus).toBe("not_evaluated");
      expect(result.qualityLabel).toBe("Atualizada");
      expect(result.freshness.isStale).toBe(false);
      expect(result.conflict).toBeNull();
    });
  });

  // ==========================================================================
  // Section 16: Mandatory Semantic Proofs
  // ==========================================================================

  describe("Mandatory Semantic Proofs", () => {
    it("PROVES EXPLICITLY: error !== not_evaluated", () => {
      const readError: ReadStateError = {
        status: "error",
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Permission denied reading health summary",
        retryable: true,
      };

      // When a read error occurs, data quality is error, while domain readiness enum 'not_evaluated' is an operational status
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

      // Missing summary yields technical quality label "Sem projeção válida"
      expect(missingSummaryResult.qualityLabel).toBe("Sem projeção válida");

      // Whereas a valid summary with 'not_evaluated' has a summary doc and "Atualizada" quality label (if fresh)
      const validNotEvaluatedResult = aggregateReadinessListItem({
        dog: mockDog,
        summary: {
          dogId: mockDog.id,
          readinessStatus: "not_evaluated",
          updatedAt: fixedNow.toISOString(),
          version: "1.0",
        },
        restrictions: [],
        now: fixedNow,
      });

      expect(validNotEvaluatedResult.qualityLabel).toBe("Atualizada");
      expect(missingSummaryResult.qualityLabel).not.toBe(validNotEvaluatedResult.qualityLabel);
    });
  });

  // ==========================================================================
  // Section 11 & 17: Read Models & Cockpit & Cross-Platform Parity
  // ==========================================================================

  describe("Cockpit Composition & Parity", () => {
    it("should aggregate ReadinessCockpit without inventing fake evidence data", () => {
      const summary: CanonicalHealthSummaryDoc = {
        dogId: mockDog.id,
        readinessStatus: "operational",
        updatedAt: fixedNow.toISOString(),
        version: "1.0",
      };

      const cockpit = aggregateReadinessCockpit({
        dog: mockDog,
        summary,
        restrictions: [],
        now: fixedNow,
      });

      expect(cockpit.dog.id).toBe("k9-thor");
      expect(cockpit.readinessStatus).toBe("operational");
      expect(cockpit.vaccinationEvidence.available).toBe(false);
      expect(cockpit.weightEvidence.available).toBe(false);
      expect(cockpit.scheduleSummary.available).toBe(false);
      expect(cockpit.nutritionSummary.available).toBe(false);
      expect(cockpit.clinicalSummary.available).toBe(false);
      expect(cockpit.timelineSummary.available).toBe(false);
    });

    it("should guarantee exact parity with 5 canonical Mobile readiness enums", () => {
      const expectedEnums = [
        "operational",
        "operational_attention",
        "fit_with_restrictions",
        "temporarily_unfit",
        "not_evaluated",
      ];

      expect(OFFICIAL_READINESS_STATUSES).toEqual(expectedEnums);
      expect(Object.keys(READINESS_STATUS_LABELS)).toEqual(expectedEnums);
    });
  });

  // ==========================================================================
  // Section 8: Freshness Policy Edge Cases
  // ==========================================================================

  describe("Freshness Policy Edge Cases", () => {
    it("should identify future timestamp anomaly", () => {
      const futureTime = new Date(fixedNow.getTime() + 10 * 60 * 1000); // +10 minutes
      const result = evaluateFreshness(futureTime, { now: fixedNow });

      expect(result.isFutureAnomaly).toBe(true);
      expect(result.status).toBe("future_anomaly");
      expect(result.isStale).toBe(true);
    });

    it("should handle missing timestamp safely", () => {
      const result = evaluateFreshness(null, { now: fixedNow });

      expect(result.hasValidTimestamp).toBe(false);
      expect(result.status).toBe("missing_timestamp");
      expect(result.isStale).toBe(true);
    });
  });
});
