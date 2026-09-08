/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I3
 * Schedule institutional scope composition + per-dog read orchestration.
 *
 * OBJECTIVE:
 * - Compose the GLOBAL Agenda list from the institutional K9 scope.
 * - Institutional identity comes from `dogs/{dogId}` through the SAME shared
 *   mapper the Readiness workforce list uses (`toDogIdentity`), imported without
 *   modification. This module never becomes a second owner of K9 identity.
 * - Per-dog Schedule reads are delegated to `readScheduleForDog`. This module
 *   orchestrates; it never re-reads.
 *
 * HARD BOUNDARIES:
 * - The ONLY collections touched are `dogs` (once) and, transitively through the
 *   reader, `dogs/{dogId}/health_schedule`. No secondary N+1 read.
 * - `loadReadinessScope()` is deliberately NOT called: it fans out to
 *   health_summary + operational_restrictions per dog, which this gate forbids.
 *   Only its stable exported identity mapper is reused.
 * - NO collectionGroup. NO `where`/`orderBy`/`limit`, so NO composite index.
 * - Strictly READ-ONLY and one-shot (`getDocs`).
 * - NO temporal derivation: `temporal.ts` is not imported and no `now` is taken.
 *   Set completeness must never depend on a clock.
 * - NO presentation filtering. The complete loaded set is returned; later layers
 *   filter it.
 *
 * GLOBAL STATE SEMANTICS — a denial NEVER becomes emptiness:
 * - success  : scope + every authorized read succeeded, >=1 item, no coverage loss.
 * - empty    : scope genuinely empty, OR >=1 authorized read executed and every
 *              authorized read returned zero items, with zero forbidden and
 *              zero failed reads.
 * - partial  : ANY mixed coverage (authorized + forbidden/failed, or any partial
 *              document).
 * - forbidden: zero authorized reads and every failure was a denial.
 * - error    : zero authorized reads with at least one technical failure.
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DogIdentityReadModel } from "../../domain/readiness-types";
import type { ReadState } from "../../domain/read-states";
import { toDogIdentity } from "../../presentation/hooks/load-readiness-scope";
import type { ScheduleItemReadModel } from "../types";
import { SCHEDULE_READ_CAPABILITY, readScheduleForDog } from "./schedule-reader";

/** Institutional catalog collection. Readable by any signed-in user. */
export const SCHEDULE_SCOPE_COLLECTION = "dogs";

/** Separator for the convenience aggregate key. */
export const SCHEDULE_ENTRY_ID_SEPARATOR = ":";

/**
 * Stable list identity for a Schedule item in the GLOBAL list.
 *
 * A `scheduleId` alone is NOT unique across dogs, so identity is always the pair.
 *
 * NON-AUTHORITATIVE: this string is a composition/React key only. It must never
 * be parsed back to recover `dogId`/`scheduleId`, and never used for
 * authorization — the structured fields on the entry remain the authority. (A
 * Firestore document ID could in principle contain the separator; recorded as
 * technical debt rather than solved here, precisely because nothing parses it.)
 */
export function scheduleEntryId(dogId: string, scheduleId: string): string {
  return `${dogId}${SCHEDULE_ENTRY_ID_SEPARATOR}${scheduleId}`;
}

/**
 * Composition wrapper.
 *
 * The frozen RD-I1 read model is carried by reference and left untouched;
 * institutional identity lives beside it, never merged into it.
 */
export interface ScheduleListEntry {
  /** `${dogId}:${scheduleId}` — stable across renders, unique in the list. */
  entryId: string;
  /** STRUCTURAL dog identity from the read path — the scope authority. */
  dogId: string;
  scheduleId: string;
  /** Institutional identity from `dogs/{dogId}`, mapped by the shared mapper. */
  dog: DogIdentityReadModel;
  /** The frozen RD-I1 read model, unmodified. */
  item: ScheduleItemReadModel;
}

/**
 * Truthful coverage accounting for the composed scope.
 *
 * This is what lets a consumer say "8 itens + 2 canis não autorizados" instead
 * of silently presenting an incomplete list as if it were the whole truth.
 *
 * Deliberately NOT present (no consumer; `item.dataQuality` already carries it):
 * `legacyEntryIds`, `degradedEntryIds`, `temporalUnavailableEntryIds`.
 */
export interface ScheduleScopeCoverage {
  /** K9s present in the institutional scope read. */
  dogsInScope: number;
  /** Dogs whose Schedule read produced a usable answer (items or proven zero). */
  authorizedDogIds: string[];
  /** Dogs whose Schedule read was denied by Rules — coverage unknown, not zero. */
  forbiddenDogIds: string[];
  /** Dogs whose Schedule read failed technically — coverage unknown, not zero. */
  failedDogIds: string[];
  /** Composite entry ids of items whose document was not fully trustworthy. */
  partialEntryIds: string[];
  /**
   * True when the list provably represents the whole trustworthy truth.
   *
   * Ratified semantics: `complete === true` iff there are no forbidden dogs, no
   * failed dogs AND no partial items. A successful dog with zero items does NOT
   * reduce completeness; neither do `legacy` or `degraded` items.
   */
  complete: boolean;
}

export interface ScheduleScopeResult {
  /** Canonical technical read state over the composed global list. */
  state: ReadState<ScheduleListEntry[]>;
  /** Always present, including on forbidden/error, so callers can be truthful. */
  coverage: ScheduleScopeCoverage;
}

/**
 * Detects a Firestore permission failure on the CATALOG read.
 *
 * Mirrors the per-dog reader's classifier; kept local for the same frozen-surface
 * reason recorded there.
 */
function isScopePermissionDenied(err: unknown): boolean {
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

/** Milliseconds of the primary sort anchor, or null when unavailable. */
function sortAnchorMs(entry: ScheduleListEntry): number | null {
  return entry.item.scheduledFor ? entry.item.scheduledFor.getTime() : null;
}

/**
 * Deterministic Agenda ordering (Control Tower ratified, RD-I3).
 *
 *   PRIMARY      scheduledFor ASC   — earliest scheduled instant first
 *   NULL ANCHOR  last               — retained, never dropped
 *   TIE-BREAK 1  scheduleId ASC
 *   TIE-BREAK 2  dogId ASC
 *
 * ASC is deliberate and differs from the Clinical activity log's DESC: an Agenda
 * is forward-looking. `createdAt` is intentionally NOT a secondary anchor, and
 * Firestore snapshot order is never relied upon, so the result never depends on
 * read timing.
 *
 * Items with a malformed/absent `scheduledFor` sink to the end rather than being
 * hidden — an undisplayable deadline is not a reason to lose the record.
 */
export function sortScheduleListEntries(entries: ScheduleListEntry[]): ScheduleListEntry[] {
  return [...entries].sort((left, right) => {
    const leftMs = sortAnchorMs(left);
    const rightMs = sortAnchorMs(right);

    if (leftMs !== rightMs) {
      if (leftMs === null) return 1;
      if (rightMs === null) return -1;
      return leftMs - rightMs; // ASC
    }

    const byScheduleId = left.scheduleId.localeCompare(right.scheduleId);
    if (byScheduleId !== 0) return byScheduleId;
    return left.dogId.localeCompare(right.dogId);
  });
}

/**
 * Loads and composes the GLOBAL Agenda list.
 *
 * Callers MUST NOT invoke this until Schedule read authority is proven by the
 * later authority layer. This function does not evaluate capability itself;
 * Firestore Rules remain the final per-dog authority and a denial is reported
 * truthfully rather than hidden.
 */
export async function loadScheduleScope(): Promise<ScheduleScopeResult> {
  // --- institutional catalog (single read) ----------------------------------
  let dogs: DogIdentityReadModel[];
  try {
    const dogsSnap = await getDocs(collection(db, SCHEDULE_SCOPE_COLLECTION));
    dogs = dogsSnap.docs.map((docSnap) =>
      toDogIdentity(docSnap.id, docSnap.data() as Record<string, unknown>)
    );
  } catch (err: unknown) {
    const emptyCoverage: ScheduleScopeCoverage = {
      dogsInScope: 0,
      authorizedDogIds: [],
      forbiddenDogIds: [],
      failedDogIds: [],
      partialEntryIds: [],
      complete: false,
    };

    if (isScopePermissionDenied(err)) {
      return {
        state: {
          status: "forbidden",
          requiredCapability: SCHEDULE_READ_CAPABILITY,
          message: "Escopo institucional de K9 não autorizado para o acesso atual.",
        },
        coverage: emptyCoverage,
      };
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      state: {
        status: "error",
        code: "SCHEDULE_SCOPE_READ_ERROR",
        message: `Falha ao ler o escopo institucional de K9: ${message}`,
        technicalDetails: String(err),
        retryable: true,
      },
      coverage: emptyCoverage,
    };
  }

  if (dogs.length === 0) {
    return {
      state: { status: "empty", query: SCHEDULE_SCOPE_COLLECTION },
      coverage: {
        dogsInScope: 0,
        authorizedDogIds: [],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    };
  }

  const authorizedDogIds: string[] = [];
  const forbiddenDogIds: string[] = [];
  const failedDogIds: string[] = [];
  const partialEntryIds: string[] = [];
  const failedSources: string[] = [];
  const successfulSources: string[] = [];
  const entries: ScheduleListEntry[] = [];

  // `Promise.all` is safe ONLY because `readScheduleForDog` converts every
  // expected failure into a typed ReadState and never rejects. One dog's denial
  // or failure therefore cannot erase the successful dogs.
  const perDogStates = await Promise.all(
    dogs.map(async (dog) => ({
      dog,
      state: await readScheduleForDog(dog.id),
    }))
  );

  const collect = (dog: DogIdentityReadModel, items: ScheduleItemReadModel[]) => {
    for (const item of items) {
      const entry: ScheduleListEntry = {
        entryId: scheduleEntryId(dog.id, item.scheduleId),
        dogId: dog.id,
        scheduleId: item.scheduleId,
        dog,
        item,
      };
      entries.push(entry);
      // Only a genuine document defect counts as coverage loss. `legacy` and
      // `degraded` items are readable records, not missing coverage.
      if (item.dataQuality === "partial") {
        partialEntryIds.push(entry.entryId);
      }
    }
  };

  for (const { dog, state } of perDogStates) {
    switch (state.status) {
      case "success":
        authorizedDogIds.push(dog.id);
        successfulSources.push(`dogs/${dog.id}`);
        collect(dog, state.data);
        break;

      case "empty":
        // A proven zero is a usable answer, not coverage loss.
        authorizedDogIds.push(dog.id);
        successfulSources.push(`dogs/${dog.id}`);
        break;

      case "partial":
        authorizedDogIds.push(dog.id);
        successfulSources.push(`dogs/${dog.id}`);
        collect(dog, state.partialData);
        break;

      case "forbidden":
        forbiddenDogIds.push(dog.id);
        failedSources.push(`dogs/${dog.id}`);
        break;

      default:
        failedDogIds.push(dog.id);
        failedSources.push(`dogs/${dog.id}`);
        break;
    }
  }

  const sortedEntries = sortScheduleListEntries(entries);

  const coverageLoss =
    forbiddenDogIds.length > 0 || failedDogIds.length > 0 || partialEntryIds.length > 0;

  const coverage: ScheduleScopeCoverage = {
    dogsInScope: dogs.length,
    authorizedDogIds,
    forbiddenDogIds,
    failedDogIds,
    partialEntryIds,
    complete: !coverageLoss,
  };

  // No authorized result at all: the outcome is an authority or transport fact,
  // and must not be presented as a list.
  if (authorizedDogIds.length === 0) {
    if (failedDogIds.length === 0 && forbiddenDogIds.length > 0) {
      return {
        state: {
          status: "forbidden",
          requiredCapability: SCHEDULE_READ_CAPABILITY,
          message: "Nenhuma agenda autorizada para o perfil de acesso atual.",
        },
        coverage,
      };
    }

    return {
      state: {
        status: "error",
        code: "SCHEDULE_SCOPE_NO_AUTHORIZED_READ",
        message: "Não foi possível obter nenhuma leitura de agenda confiável no escopo institucional.",
        technicalDetails: `forbidden=${forbiddenDogIds.length} failed=${failedDogIds.length} dogsInScope=${dogs.length}`,
        retryable: true,
      },
      coverage,
    };
  }

  if (coverageLoss) {
    // Mixed coverage — including "all authorized dogs empty but one denied".
    return {
      state: {
        status: "partial",
        partialData: sortedEntries,
        failedSources,
        successfulSources,
      },
      coverage,
    };
  }

  if (sortedEntries.length === 0) {
    // Every dog answered and every answer was a proven zero.
    return {
      state: { status: "empty", query: SCHEDULE_SCOPE_COLLECTION },
      coverage,
    };
  }

  return {
    state: { status: "success", data: sortedEntries, fetchedAt: new Date() },
    coverage,
  };
}
