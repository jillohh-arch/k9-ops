/**
 * K9 Ops Web — Health Web v1 HW-6B / F20.1 Intake
 * Clinical Events & Amendments Firestore Reader
 *
 * CANONICAL PATHS (strictly scoped):
 * - Events: dogs/{dogId}/clinical_cases/{caseId}/clinical_events
 * - Amendments: dogs/{dogId}/clinical_cases/{caseId}/clinical_events/{eventId}/clinical_amendments
 *
 * Front 20 Clinical Read authority:
 * - Requires explicit `health.read` capability with NO admin bypass.
 * - DogId and CaseId are structural path segments.
 *
 * Invariants:
 * - Strictly READ-ONLY. No write/callable operations.
 * - Single-field orderBy("occurred_at", "desc") for events.
 * - Single-field orderBy("recorded_at", "asc") for amendments.
 * - PERMISSION_DENIED maps to `forbidden` (NEVER empty).
 * - Degraded/partial documents degrade to `partial`, never dropping valid siblings.
 */

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { ReadState } from "../../domain/read-states";
import {
  parseClinicalEventWireDoc,
  parseClinicalAmendmentWireDoc,
} from "../parser/clinical-event-parser";
import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";

export const CLINICAL_READ_CAPABILITY = "health.read";
export const CLINICAL_EVENTS_COLLECTION = "clinical_events";
export const CLINICAL_AMENDMENTS_COLLECTION = "clinical_amendments";

async function getFirestoreDb() {
  const client = await import("@/lib/firebase/client");
  return client.db;
}

function isPermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    const normalized = code.toLowerCase();
    if (normalized === "permission-denied" || normalized === "firestore/permission-denied") {
      return true;
    }
  }
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
 * Reads all ClinicalEvents for a case under `dogs/{dogId}/clinical_cases/{caseId}/clinical_events`.
 * Ordered canonical: occurred_at DESC.
 */
export async function readClinicalEventsForCase(
  dogId: string,
  caseId: string
): Promise<ReadState<ClinicalEventReadModel[]>> {
  if (!dogId || !dogId.trim()) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura de eventos clínicos.",
      retryable: false,
    };
  }
  if (!caseId || !caseId.trim()) {
    return {
      status: "error",
      code: "INVALID_CASE_ID",
      message: "Identificador do caso é obrigatório para leitura de eventos clínicos.",
      retryable: false,
    };
  }

  const cleanDogId = dogId.trim();
  const cleanCaseId = caseId.trim();
  const pathDescriptor = `dogs/${cleanDogId}/clinical_cases/${cleanCaseId}/${CLINICAL_EVENTS_COLLECTION}`;

  try {
    const db = await getFirestoreDb();
    const eventsRef = collection(
      db,
      "dogs",
      cleanDogId,
      "clinical_cases",
      cleanCaseId,
      CLINICAL_EVENTS_COLLECTION
    );
    const q = query(eventsRef, orderBy("occurred_at", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        status: "empty",
        query: pathDescriptor,
      };
    }

    const events: ClinicalEventReadModel[] = [];
    const degradedEventIds: string[] = [];

    for (const docSnap of snapshot.docs) {
      const parsed = parseClinicalEventWireDoc(
        docSnap.data(),
        docSnap.id,
        cleanCaseId,
        cleanDogId
      );
      events.push(parsed);
      if (parsed.dataQualityIssues.length > 0) {
        degradedEventIds.push(docSnap.id);
      }
    }

    // Defensive in-memory sort fallback (occurredAt DESC, fallback to recordedAt or epoch 0)
    events.sort((a, b) => {
      const aTime = a.occurredAt?.getTime() ?? a.recordedAt?.getTime() ?? 0;
      const bTime = b.occurredAt?.getTime() ?? b.recordedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    if (events.length === 0) {
      return {
        status: "empty",
        query: pathDescriptor,
      };
    }

    if (degradedEventIds.length > 0) {
      const successfulIds = events
        .filter((e) => e.dataQualityIssues.length === 0)
        .map((e) => e.id);
      return {
        status: "partial",
        partialData: events,
        failedSources: degradedEventIds.map((id) => `${pathDescriptor}/${id}`),
        successfulSources: successfulIds.map((id) => `${pathDescriptor}/${id}`),
      };
    }

    return {
      status: "success",
      data: events,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    if (isPermissionDenied(err)) {
      return {
        status: "forbidden",
        requiredCapability: CLINICAL_READ_CAPABILITY,
        message: "Consulta aos eventos clínicos não permitida para o perfil atual.",
      };
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido ao ler eventos clínicos";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler eventos clínicos do caso '${cleanCaseId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}

/**
 * Reads all ClinicalAmendments for an event under
 * `dogs/{dogId}/clinical_cases/{caseId}/clinical_events/{eventId}/clinical_amendments`.
 * Ordered canonical: recorded_at ASC.
 */
export async function readClinicalAmendmentsForEvent(
  dogId: string,
  caseId: string,
  eventId: string
): Promise<ReadState<ClinicalAmendmentReadModel[]>> {
  if (!dogId || !dogId.trim()) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura de emendas.",
      retryable: false,
    };
  }
  if (!caseId || !caseId.trim()) {
    return {
      status: "error",
      code: "INVALID_CASE_ID",
      message: "Identificador do caso é obrigatório para leitura de emendas.",
      retryable: false,
    };
  }
  if (!eventId || !eventId.trim()) {
    return {
      status: "error",
      code: "INVALID_EVENT_ID",
      message: "Identificador do evento é obrigatório para leitura de emendas.",
      retryable: false,
    };
  }

  const cleanDogId = dogId.trim();
  const cleanCaseId = caseId.trim();
  const cleanEventId = eventId.trim();
  const pathDescriptor = `dogs/${cleanDogId}/clinical_cases/${cleanCaseId}/${CLINICAL_EVENTS_COLLECTION}/${cleanEventId}/${CLINICAL_AMENDMENTS_COLLECTION}`;

  try {
    const db = await getFirestoreDb();
    const amendmentsRef = collection(
      db,
      "dogs",
      cleanDogId,
      "clinical_cases",
      cleanCaseId,
      CLINICAL_EVENTS_COLLECTION,
      cleanEventId,
      CLINICAL_AMENDMENTS_COLLECTION
    );
    const q = query(amendmentsRef, orderBy("recorded_at", "asc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        status: "empty",
        query: pathDescriptor,
      };
    }

    const amendments: ClinicalAmendmentReadModel[] = [];
    const degradedIds: string[] = [];

    let idx = 0;
    for (const docSnap of snapshot.docs) {
      idx++;
      const parsed = parseClinicalAmendmentWireDoc(
        docSnap.data(),
        docSnap.id,
        cleanEventId,
        cleanCaseId,
        cleanDogId,
        idx
      );
      amendments.push(parsed);
      if (parsed.dataQualityIssues.length > 0) {
        degradedIds.push(docSnap.id);
      }
    }

    // Defensive in-memory sort fallback (recordedAt ASC)
    amendments.sort((a, b) => {
      const aTime = a.recordedAt?.getTime() ?? 0;
      const bTime = b.recordedAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    if (amendments.length === 0) {
      return {
        status: "empty",
        query: pathDescriptor,
      };
    }

    if (degradedIds.length > 0) {
      const successfulIds = amendments
        .filter((a) => a.dataQualityIssues.length === 0)
        .map((a) => a.id);
      return {
        status: "partial",
        partialData: amendments,
        failedSources: degradedIds.map((id) => `${pathDescriptor}/${id}`),
        successfulSources: successfulIds.map((id) => `${pathDescriptor}/${id}`),
      };
    }

    return {
      status: "success",
      data: amendments,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    if (isPermissionDenied(err)) {
      return {
        status: "forbidden",
        requiredCapability: CLINICAL_READ_CAPABILITY,
        message: "Consulta às emendas clínicas não permitida para o perfil atual.",
      };
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido ao ler emendas clínicas";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler emendas do evento '${cleanEventId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}
