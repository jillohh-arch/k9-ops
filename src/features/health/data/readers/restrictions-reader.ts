/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Operational Restrictions Firestore Reader
 *
 * Implements read-only access to dogs/{dogId}/operational_restrictions.
 *
 * CRITICAL MANDATE:
 * - Strictly READ-ONLY (no setDoc, addDoc, updateDoc, deleteDoc).
 * - Discriminated ReadState return type.
 */

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import type { CanonicalRestrictionDoc } from "../../domain/readiness-types";

/**
 * Reads active operational restrictions for a K9.
 * Path: dogs/{dogId}/operational_restrictions where status == 'active'
 */
export async function readCanonicalOperationalRestrictions(
  dogId: string
): Promise<ReadState<CanonicalRestrictionDoc[]>> {
  if (!dogId) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura de restrições.",
      retryable: false,
    };
  }

  try {
    const restrictionsRef = collection(db, "dogs", dogId, "operational_restrictions");
    const q = query(restrictionsRef, where("status", "==", "active"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        status: "empty",
        query: `dogs/${dogId}/operational_restrictions?status=active`,
      };
    }

    const restrictions: CanonicalRestrictionDoc[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        dogId: data.dogId || dogId,
        level: data.level || data.type || "attention",
        status: data.status || "active",
        category: data.category || "operational",
        reason: data.reason || "Restrição registrada",
        description: data.description ?? null,
        restrictedActivities: Array.isArray(data.restrictedActivities) ? data.restrictedActivities : [],
        issuedAt: data.issuedAt ?? new Date(),
        issuedBy: data.issuedBy || "Profissional Responsável",
        expectedEnd: data.expectedEnd ?? null,
        actualEnd: data.actualEnd ?? null,
        authority: data.authority ?? null,
        sourceDocumentUrl: data.sourceDocumentUrl ?? null,
        clinicalCaseId: data.clinicalCaseId ?? null,
      };
    });

    return {
      status: "success",
      data: restrictions,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao ler restrições";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler restrições operacionais para o cão '${dogId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}
