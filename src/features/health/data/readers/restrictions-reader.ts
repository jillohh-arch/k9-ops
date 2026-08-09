/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Operational Restrictions Firestore Reader (Corrected)
 *
 * Reads raw snake_case documents at dogs/{dogId}/operational_restrictions
 * and parses them using strict parseOperationalRestrictionWireDoc.
 *
 * CRITICAL MANDATES:
 * - Strictly READ-ONLY (no setDoc, addDoc, updateDoc, deleteDoc).
 * - Parses raw Firestore snake_case documents through strict wire parser.
 * - Discriminated ReadState return type.
 */

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import type { CanonicalRestrictionDoc } from "../../domain/readiness-types";
import { parseOperationalRestrictionWireDoc } from "../../domain/wire-parsers";

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

    const restrictions: CanonicalRestrictionDoc[] = [];

    for (const docSnap of snapshot.docs) {
      const parsed = parseOperationalRestrictionWireDoc(docSnap.data(), docSnap.id, dogId);
      if (parsed) {
        restrictions.push(parsed);
      }
    }

    if (restrictions.length === 0) {
      return {
        status: "empty",
        query: `dogs/${dogId}/operational_restrictions?status=active`,
      };
    }

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
