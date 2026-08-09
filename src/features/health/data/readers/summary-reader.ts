/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Health Summary Firestore Reader
 *
 * Implements read-only access to dogs/{dogId}/health_summary/current.
 *
 * CRITICAL MANDATE:
 * - Strictly READ-ONLY (no setDoc, addDoc, updateDoc, deleteDoc).
 * - No dual read from legacy.
 * - Discriminated ReadState return type.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import type { CanonicalHealthSummaryDoc } from "../../domain/readiness-types";

export interface ReadSummaryOptions {
  timeoutMs?: number;
}

/**
 * Reads the canonical health summary projection document for a K9.
 * Path: dogs/{dogId}/health_summary/current
 */
export async function readCanonicalHealthSummary(
  dogId: string
): Promise<ReadState<CanonicalHealthSummaryDoc>> {
  if (!dogId) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura do summary.",
      retryable: false,
    };
  }

  try {
    const summaryRef = doc(db, "dogs", dogId, "health_summary", "current");
    const snapshot = await getDoc(summaryRef);

    if (!snapshot.exists()) {
      return {
        status: "empty",
        query: `dogs/${dogId}/health_summary/current`,
      };
    }

    const data = snapshot.data();
    const summaryDoc: CanonicalHealthSummaryDoc = {
      dogId: data.dogId || dogId,
      readinessStatus: data.readinessStatus || "not_evaluated",
      readinessReason: data.readinessReason ?? null,
      activeRestrictionsCount: typeof data.activeRestrictionsCount === "number" ? data.activeRestrictionsCount : 0,
      activeTreatmentsCount: typeof data.activeTreatmentsCount === "number" ? data.activeTreatmentsCount : 0,
      pendingExamsCount: typeof data.pendingExamsCount === "number" ? data.pendingExamsCount : 0,
      dataCompleteness: typeof data.dataCompleteness === "number" ? data.dataCompleteness : null,
      lastEvaluatedAt: data.lastEvaluatedAt ?? null,
      updatedAt: data.updatedAt ?? null,
      version: data.version ?? null,
      source: data.source || `dogs/${dogId}/health_summary/current`,
    };

    return {
      status: "success",
      data: summaryDoc,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao ler health_summary";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler prontidão canônica para o cão '${dogId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}
