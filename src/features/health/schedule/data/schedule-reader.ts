/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I3
 * Per-Dog Nested Schedule Firestore Reader
 *
 * CANONICAL PATH (the ONLY path this module reads):
 *   dogs/{dogId}/health_schedule
 *
 * Deployed Front20 authority (proven in HW-4.WEB-SCHED-P1.A0):
 *   allow read: if signedIn() && canAccessDogRecord(dogId)
 * where `dogId` is the STRUCTURAL path segment. A collection-group `list` rule
 * also exists, but per-dog fan-out is the frozen v1 topology because it yields
 * exact per-K9 denial attribution, needs no `in` chunking, and depends on no
 * composite index.
 *
 * CRITICAL MANDATES:
 * - NO collectionGroup. Frozen topology decision, not a preference.
 * - The read is UNFILTERED: no `where`, `orderBy` or `limit`. Filtering by type,
 *   lifecycle, temporal status or display window happens only AFTER complete
 *   retrieval, so that "nothing was silently omitted" stays provable.
 * - Strictly READ-ONLY and one-shot (`getDocs`): no listeners, no writes,
 *   no callables.
 * - PERMISSION_DENIED maps to `forbidden` and MUST NEVER become `empty`.
 * - This module NEVER rejects for an expected Firestore failure. Every outcome
 *   becomes a typed `ReadState`, which is precisely what makes the scope
 *   loader's `Promise.all` fan-out safe (see `schedule-scope-loader.ts`).
 * - NO temporal derivation. `temporal.ts` is deliberately not imported: set
 *   completeness must not depend on a clock.
 *
 * COMPLETENESS INVARIANT (load-bearing):
 *   For any successful read, `items.length === snapshot.size`.
 * The frozen RD-I1 parser returns a `ScheduleItemReadModel` for EVERY document —
 * it has no `throw` and no document-level `null` return, so a malformed document
 * degrades to `partial` instead of disappearing. This module therefore never
 * catches-and-discards an individual document.
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import { parseScheduleItemWireDoc } from "../parser";
import type { ScheduleItemReadModel } from "../types";

/**
 * Capability reported when a Schedule read is denied.
 *
 * The deployed nested rule gates on `canAccessDogRecord` alone, but the Web
 * surface gates Agenda on the explicit `health.read` capability (frozen in
 * P1.R2 §19), deliberately stricter than the server floor. Legacy `health.view`
 * is NOT accepted.
 */
export const SCHEDULE_READ_CAPABILITY = "health.read";

/** Canonical nested subcollection name. */
export const SCHEDULE_COLLECTION = "health_schedule";

/** Stable descriptor used in `empty`/`partial` states for diagnostics. */
export function scheduleQueryDescriptor(dogId: string): string {
  return `dogs/${dogId}/${SCHEDULE_COLLECTION}`;
}

/**
 * Detects a Firestore permission failure across the shapes the SDK surfaces
 * (`FirebaseError.code`, or a message carrying the denial).
 *
 * Intentionally duplicated from the frozen Clinical reader, whose equivalent
 * helper is module-private. Exporting from Clinical to deduplicate would mean
 * editing a frozen surface for no behavioural gain; this is accepted technical
 * debt recorded in RD-I3.R1 §9.
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
 * Reads ALL Schedule items for a single K9 via the nested path.
 *
 * State mapping:
 *   docs present, none partial          -> success
 *   valid query, zero docs              -> empty
 *   docs present, >=1 item partial      -> partial (valid siblings kept)
 *   PERMISSION_DENIED                   -> forbidden   (NEVER empty)
 *   generic Firestore failure           -> error (retryable)
 *
 * `legacy` and `degraded` items alone do NOT downgrade the state: they are
 * readable, trustworthy-enough records, not coverage loss. Only `partial`
 * (a genuine document defect) yields `partial`.
 *
 * Ordering is intentionally NOT applied here. Snapshot order is not contractual;
 * deterministic ordering belongs to the composition layer, so this reader never
 * fabricates scheduling semantics.
 */
export async function readScheduleForDog(
  dogId: string
): Promise<ReadState<ScheduleItemReadModel[]>> {
  if (!dogId) {
    return {
      status: "error",
      code: "INVALID_DOG_ID",
      message: "Identificador do cão é obrigatório para leitura da agenda.",
      retryable: false,
    };
  }

  try {
    // Nested per-dog collection reference. The dogId is STRUCTURAL — it comes
    // from the path, never from a document payload.
    const scheduleRef = collection(db, "dogs", dogId, SCHEDULE_COLLECTION);
    const snapshot = await getDocs(scheduleRef);

    if (snapshot.empty) {
      return {
        status: "empty",
        query: scheduleQueryDescriptor(dogId),
      };
    }

    // Every document is accounted for: the frozen parser always returns a model.
    const items: ScheduleItemReadModel[] = [];
    const partialScheduleIds: string[] = [];

    for (const docSnap of snapshot.docs) {
      // scheduleId always comes from the Firestore document ID.
      const parsed = parseScheduleItemWireDoc(docSnap.data(), docSnap.id, dogId);
      items.push(parsed);
      if (parsed.dataQuality === "partial") {
        partialScheduleIds.push(parsed.scheduleId);
      }
    }

    if (partialScheduleIds.length > 0) {
      const successfulIds = items
        .filter((item) => item.dataQuality !== "partial")
        .map((item) => item.scheduleId);
      return {
        status: "partial",
        partialData: items,
        failedSources: partialScheduleIds.map(
          (scheduleId) => `${scheduleQueryDescriptor(dogId)}/${scheduleId}`
        ),
        successfulSources: successfulIds.map(
          (scheduleId) => `${scheduleQueryDescriptor(dogId)}/${scheduleId}`
        ),
      };
    }

    return {
      status: "success",
      data: items,
      fetchedAt: new Date(),
    };
  } catch (err: unknown) {
    // Authorization failure is NEVER translated into "nothing found".
    if (isPermissionDenied(err)) {
      return {
        status: "forbidden",
        requiredCapability: SCHEDULE_READ_CAPABILITY,
        message: "Consulta à agenda não permitida para o escopo de acesso atual.",
      };
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido ao ler a agenda";
    return {
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: `Falha ao ler a agenda do cão '${dogId}': ${message}`,
      technicalDetails: String(err),
      retryable: true,
    };
  }
}
