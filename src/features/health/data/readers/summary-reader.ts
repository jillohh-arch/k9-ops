/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Health Summary Firestore Reader (Corrected)
 *
 * Reads raw snake_case document at dogs/{dogId}/health_summary/current
 * and parses it using strict parseHealthSummaryWireDoc.
 *
 * CRITICAL MANDATES:
 * - Strictly READ-ONLY (no setDoc, addDoc, updateDoc, deleteDoc).
 * - No dual read from legacy.
 * - Parses raw Firestore snake_case document through strict wire parser.
 * - Discriminated ReadState return type.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import type { CanonicalHealthSummaryDoc } from "../../domain/readiness-types";
import { parseHealthSummaryWireDoc } from "../../domain/wire-parsers";

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

    const rawData = snapshot.data();
    const summaryDoc = parseHealthSummaryWireDoc(rawData, dogId);

    if (!summaryDoc) {
      return {
        status: "error",
        code: "INVALID_WIRE_DOCUMENT",
        message: `Documento health_summary/current do cão '${dogId}' possui formato inválido.`,
        retryable: false,
      };
    }

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
