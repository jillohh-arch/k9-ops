/**
 * K9 Ops Web — Health Web v1 HW-6A.I1
 * Per-Dog Nested ClinicalCase Firestore Reader
 *
 * CANONICAL PATH (the ONLY path this gate reads):
 *   dogs/{dogId}/clinical_cases
 *
 * Front 20 Clinical Read authority (f98952c, firestore.rules):
 *   allow read: if hasClinicalReadAuthority() && canAccessDogRecord(dogId)
 * where hasClinicalReadAuthority() requires the EXPLICIT `health.read`
 * capability with NO admin bypass, and dogId is the STRUCTURAL path segment.
 *
 * CRITICAL MANDATES:
 * - NO collectionGroup("clinical_cases"). This is a SECURITY/AUTHORITY
 *   contract, not a preference: no collection-group rule exists for
 *   clinical_cases in Front 20, so a CG query is denied outright and cannot
 *   recover the structural dogId the rule depends on.
 * - Strictly READ-ONLY: no setDoc/addDoc/updateDoc/deleteDoc, no callables.
 * - NO event, exam, amendment or document reads (HW-6B+).
 * - PERMISSION_DENIED maps to `forbidden` and MUST NEVER become `empty`.
 * - A malformed sibling never discards valid cases: the read degrades to
 *   `partial` while preserving every successfully parsed case.
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import { parseClinicalCaseWireDoc } from "../parser";
import type { ClinicalCaseReadModel } from "../types";

/**
 * Canonical capability required by the Clinical read path.
 * Legacy `health.view` is deliberately NOT accepted here.
 */
export const CLINICAL_READ_CAPABILITY = "health.read";

/** Canonical nested subcollection name. */
export const CLINICAL_CASES_COLLECTION = "clinical_cases";

function clinicalCasesQueryDescriptor(dogId: string): string {
  return `dogs/${dogId}/${CLINICAL_CASES_COLLECTION}`;
}

/**
 * Detects a Firestore permission failure across the shapes the SDK surfaces
 * (FirebaseError.code, or a message carrying the denial).
 */
function isPermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    const normalized = code.toLowerCase();
    if (normalized === "permission-denied" || normalized === "firestore/permission-denied") {
      return true;
    }
  }
  // The denial can also arrive only in the message, in either the SDK's
  // hyphenated form or the gRPC/underscore form. Both must map to forbidden;
  // misreading one as a generic error would understate an authorization
  // outcome.
  const message = (err as { message?: unknown }).message;
  if (typeof message === "string") {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("permission-denied") ||
      normalized.includes("permission_denied") ||
      normalized.includes("insufficient permissions")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Reads all canonical ClinicalCases for a single K9 via the nested path.
 *
 * State mapping (HW-6A.I1 §11):
 *   valid list with docs                 -> success
 *   valid query, zero docs               -> empty
 *   PERMISSION_DENIED                    -> forbidden   (NEVER empty)
 *   generic Firestore failure            -> error
 *   docs present, some malformed/partial -> partial (valid siblings kept)
 *
 * Ordering is intentionally NOT applied here. The `lastEventAt ?? openedAt`
 * activity sort belongs to the later composition layer (I2), so this reader
 * never fabricates activity semantics.
 */
export async function readClinicalCasesForDog(
  dogId: string
): Promise<ReadState<ClinicalCaseReadModel[]>> {
  if (!dogId) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura de casos clínicos.",
      retryable: false,
    };
  }

  try {
    // Nested per-dog collection reference. The dogId is STRUCTURAL — it comes
    // from the path, never from a document payload.
    const casesRef = collection(db, "dogs", dogId, CLINICAL_CASES_COLLECTION);
    const snapshot = await getDocs(casesRef);

    if (snapshot.empty) {
      return {
        status: "empty",
        query: clinicalCasesQueryDescriptor(dogId),
      };
    }

    const cases: ClinicalCaseReadModel[] = [];
    const degradedCaseIds: string[] = [];

    for (const docSnap of snapshot.docs) {
      // caseId always comes from the Firestore document ID.
      const parsed = parseClinicalCaseWireDoc(docSnap.data(), docSnap.id, dogId);
      cases.push(parsed);
      if (parsed.dataQuality === "partial") {
        degradedCaseIds.push(docSnap.id);
      }
    }

    // A non-empty snapshot always yields cases (the parser never drops a doc),
    // so this is defensive rather than expected.
    if (cases.length === 0) {
      return {
        status: "empty",
        query: clinicalCasesQueryDescriptor(dogId),
      };
    }

    if (degradedCaseIds.length > 0) {
      const successfulIds = cases
        .filter((c) => c.dataQuality === "complete")
        .map((c) => c.caseId);
      return {
        status: "partial",
        partialData: cases,
        failedSources: degradedCaseIds.map(
          (caseId) => `${clinicalCasesQueryDescriptor(dogId)}/${caseId}`
        ),
        successfulSources: successfulIds.map(
          (caseId) => `${clinicalCasesQueryDescriptor(dogId)}/${caseId}`
        ),
      };
    }

    return {
      status: "success",
      data: cases,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    // Authorization failure is NEVER translated into "nothing found".
    if (isPermissionDenied(err)) {
      return {
        status: "forbidden",
        requiredCapability: CLINICAL_READ_CAPABILITY,
        message:
          "Consulta aos registros clínicos não permitida para o escopo de acesso atual.",
      };
    }

    const message =
      err instanceof Error ? err.message : "Erro desconhecido ao ler casos clínicos";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler casos clínicos do cão '${dogId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}
