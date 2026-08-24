/**
 * K9 Ops Web — Health Web v1 HW-6A.I2
 * Clinical institutional scope composition + per-dog read orchestration.
 *
 * OBJECTIVE (I2 §1, §4, §7, §15, §16, §17, §18):
 * - Compose the GLOBAL Clinical case list from the institutional K9 scope.
 * - Institutional identity comes from `dogs/{dogId}` through the SAME shared
 *   mapper the Readiness workforce list uses (`toDogIdentity`), imported without
 *   modification. This module never becomes a second owner of K9 identity.
 * - Per-dog ClinicalCase reads are delegated to the frozen HW-6A.I1 reader
 *   (`readClinicalCasesForDog`). This module orchestrates; it never re-reads.
 *
 * HARD BOUNDARIES:
 * - The ONLY collections touched are `dogs` (once) and, transitively through the
 *   I1 reader, `dogs/{dogId}/clinical_cases`. NO secondary N+1 read for events,
 *   treatments, restrictions, schedule, documents, professionals or users.
 * - `loadReadinessScope()` is deliberately NOT called: it fans out to
 *   health_summary + operational_restrictions per dog, which this gate forbids.
 *   Only its stable exported identity mapper is reused.
 * - NO collectionGroup (structurally impossible here: the I1 reader owns the
 *   only case query and is source-tested against it).
 * - Strictly READ-ONLY and one-shot (`getDocs`): no listeners, no writes,
 *   no callables.
 * - The `ClinicalCaseReadModel` frozen in I1 is NEVER mutated. Composition adds
 *   a wrapper (`ClinicalCaseListEntry`) carrying identity plus a composite id.
 *
 * GLOBAL STATE SEMANTICS (I2 §7) — a denial NEVER becomes emptiness:
 * - success  : scope + every authorized read succeeded, >=1 case, no coverage loss.
 * - empty    : scope genuinely empty, OR >=1 authorized read executed and every
 *              authorized read returned zero cases, with zero forbidden and
 *              zero failed reads.
 * - partial  : ANY mixed coverage (authorized + forbidden, authorized + failure,
 *              or any partial document) while >=1 authorized result exists,
 *              preserving every trustworthy case.
 * - forbidden: every attempted read was denied and no authorized result exists.
 * - error    : the institutional source failed globally, OR only technical
 *              failures remain with no meaningful authorized result.
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ReadState } from "../../domain/read-states";
import type { DogIdentityReadModel } from "../../domain/readiness-types";
import { toDogIdentity } from "../../presentation/hooks/load-readiness-scope";
import {
  CLINICAL_READ_CAPABILITY,
  readClinicalCasesForDog,
} from "./clinical-cases-reader";
import type { ClinicalCaseReadModel } from "../types";

/** Institutional K9 collection — the single scope source. */
export const CLINICAL_SCOPE_COLLECTION = "dogs";

/** Composite list identity separator (I2 §17). */
export const CLINICAL_ENTRY_ID_SEPARATOR = ":";

/**
 * Stable list identity for a Clinical case in the GLOBAL list.
 * A caseId alone is NOT unique across dogs, so identity is always the pair.
 */
export function clinicalEntryId(dogId: string, caseId: string): string {
  return `${dogId}${CLINICAL_ENTRY_ID_SEPARATOR}${caseId}`;
}

/**
 * Composition wrapper (I2 §16).
 *
 * The canonical case read model is carried by reference and left untouched;
 * institutional identity lives beside it, never merged into it.
 */
export interface ClinicalCaseListEntry {
  /** `${dogId}:${caseId}` — stable across renders and unique in the list. */
  entryId: string;
  dogId: string;
  caseId: string;
  /** Institutional identity from `dogs/{dogId}`, mapped by the shared mapper. */
  dog: DogIdentityReadModel;
  /** The frozen HW-6A.I1 read model, unmodified. */
  case: ClinicalCaseReadModel;
}

/**
 * Truthful coverage accounting for the composed scope.
 *
 * This is what lets a consumer say "3 casos + 2 canis não autorizados" instead
 * of silently presenting an incomplete list as if it were the whole truth.
 */
export interface ClinicalScopeCoverage {
  /** K9s present in the institutional scope read. */
  dogsInScope: number;
  /** Dogs whose Clinical read produced a usable answer (cases or proven zero). */
  authorizedDogIds: string[];
  /** Dogs whose Clinical read was denied by Rules — coverage unknown, not zero. */
  forbiddenDogIds: string[];
  /** Dogs whose Clinical read failed technically — coverage unknown, not zero. */
  failedDogIds: string[];
  /** Composite entry ids of cases whose document was not fully trustworthy. */
  partialEntryIds: string[];
  /** True when the list provably represents the whole institutional scope. */
  complete: boolean;
}

export interface ClinicalScopeResult {
  /** Canonical technical read state over the composed global list. */
  state: ReadState<ClinicalCaseListEntry[]>;
  /** Always present, including on forbidden/error, so callers can be truthful. */
  coverage: ClinicalScopeCoverage;
}

function emptyCoverage(): ClinicalScopeCoverage {
  return {
    dogsInScope: 0,
    authorizedDogIds: [],
    forbiddenDogIds: [],
    failedDogIds: [],
    partialEntryIds: [],
    complete: false,
  };
}

/**
 * Local permission-denial detector for the INSTITUTIONAL scope read only.
 *
 * The equivalent predicate inside the I1 reader is intentionally not exported
 * and I1 is frozen for this gate, so this is a deliberate narrow duplicate
 * rather than an edit to a reviewed file.
 */
function isScopePermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    const normalized = code.toLowerCase();
    if (
      normalized === "permission-denied" ||
      normalized === "firestore/permission-denied"
    ) {
      return true;
    }
  }
  const message = (err as { message?: unknown }).message;
  if (typeof message === "string") {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("permission-denied") ||
      normalized.includes("permission_denied") ||
      normalized.includes("insufficient permissions")
    );
  }
  return false;
}

/**
 * Activity anchor used ONLY for ordering (I2 §15).
 *
 * `openedAt` is a sort fallback, never a substitute display value: no
 * "última atividade" is synthesized anywhere in this module.
 */
function sortAnchorMs(entry: ClinicalCaseListEntry): number | null {
  const anchor = entry.case.lastEventAt ?? entry.case.openedAt;
  return anchor ? anchor.getTime() : null;
}

/**
 * Deterministic activity ordering: most recent first; cases with no usable
 * anchor sink to the end instead of being dropped or invented.
 * Ties break on caseId then dogId so the order never depends on read timing.
 */
export function sortClinicalListEntries(
  entries: ClinicalCaseListEntry[],
): ClinicalCaseListEntry[] {
  return [...entries].sort((left, right) => {
    const leftMs = sortAnchorMs(left);
    const rightMs = sortAnchorMs(right);

    if (leftMs !== rightMs) {
      if (leftMs === null) return 1;
      if (rightMs === null) return -1;
      return rightMs - leftMs;
    }

    const byCase = left.caseId.localeCompare(right.caseId);
    if (byCase !== 0) return byCase;
    return left.dogId.localeCompare(right.dogId);
  });
}

/**
 * Loads and composes the GLOBAL Clinical case list.
 *
 * Callers MUST NOT invoke this until Clinical read authority is proven
 * (see `useClinicalReadAuthority`). This function does not evaluate capability
 * itself; Firestore Rules remain the final per-dog authority and a denial is
 * reported truthfully rather than hidden.
 */
export async function loadClinicalScope(): Promise<ClinicalScopeResult> {
  let dogs: DogIdentityReadModel[];

  try {
    const dogsSnap = await getDocs(collection(db, CLINICAL_SCOPE_COLLECTION));

    if (dogsSnap.empty) {
      // A genuinely empty institution is the ONE legitimate global emptiness
      // that requires no Clinical read at all.
      return {
        state: { status: "empty", query: CLINICAL_SCOPE_COLLECTION },
        coverage: { ...emptyCoverage(), complete: true },
      };
    }

    dogs = dogsSnap.docs.map((docSnap) =>
      toDogIdentity(docSnap.id, docSnap.data() as Record<string, unknown>),
    );
  } catch (err: unknown) {
    // An institutional denial is an authorization outcome, never "no cases".
    if (isScopePermissionDenied(err)) {
      return {
        state: {
          status: "forbidden",
          requiredCapability: CLINICAL_READ_CAPABILITY,
          message:
            "Escopo institucional de K9 não autorizado para o perfil de acesso atual.",
        },
        coverage: emptyCoverage(),
      };
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      state: {
        status: "error",
        code: "CLINICAL_SCOPE_READ_ERROR",
        message: `Falha ao ler o escopo institucional de K9: ${message}`,
        technicalDetails: String(err),
        retryable: true,
      },
      coverage: emptyCoverage(),
    };
  }

  const authorizedDogIds: string[] = [];
  const forbiddenDogIds: string[] = [];
  const failedDogIds: string[] = [];
  const partialEntryIds: string[] = [];
  const failedSources: string[] = [];
  const successfulSources: string[] = [];
  const entries: ClinicalCaseListEntry[] = [];

  const perDogStates = await Promise.all(
    dogs.map(async (dog) => ({
      dog,
      state: await readClinicalCasesForDog(dog.id),
    })),
  );

  const collect = (dog: DogIdentityReadModel, cases: ClinicalCaseReadModel[]) => {
    for (const clinicalCase of cases) {
      const entry: ClinicalCaseListEntry = {
        entryId: clinicalEntryId(dog.id, clinicalCase.caseId),
        dogId: dog.id,
        caseId: clinicalCase.caseId,
        dog,
        case: clinicalCase,
      };
      entries.push(entry);
      if (clinicalCase.dataQuality === "partial") {
        partialEntryIds.push(entry.entryId);
      }
    }
  };

  for (const { dog, state } of perDogStates) {
    const descriptor = `${CLINICAL_SCOPE_COLLECTION}/${dog.id}/clinical_cases`;

    switch (state.status) {
      case "success":
        authorizedDogIds.push(dog.id);
        successfulSources.push(descriptor);
        collect(dog, state.data);
        break;

      case "empty":
        // A proven zero. This is the only way a dog contributes nothing
        // without costing coverage.
        authorizedDogIds.push(dog.id);
        successfulSources.push(descriptor);
        break;

      case "partial":
        // Authorized read whose documents were not all trustworthy. Every
        // valid sibling is preserved (I1 semantics: nothing is discarded).
        authorizedDogIds.push(dog.id);
        successfulSources.push(descriptor);
        collect(dog, state.partialData);
        break;

      case "forbidden":
        // Coverage for this K9 is UNKNOWN, never zero.
        forbiddenDogIds.push(dog.id);
        failedSources.push(`forbidden:${descriptor}`);
        break;

      default:
        // Any other terminal state is a technical coverage loss.
        failedDogIds.push(dog.id);
        failedSources.push(`error:${descriptor}`);
        break;
    }
  }

  for (const entryId of partialEntryIds) {
    failedSources.push(`partial_document:${entryId}`);
  }

  const sorted = sortClinicalListEntries(entries);
  const coverageLoss =
    forbiddenDogIds.length > 0 ||
    failedDogIds.length > 0 ||
    partialEntryIds.length > 0;

  const coverage: ClinicalScopeCoverage = {
    dogsInScope: dogs.length,
    authorizedDogIds,
    forbiddenDogIds,
    failedDogIds,
    partialEntryIds,
    complete: !coverageLoss,
  };

  // No authorized result at all: the outcome is an authority or transport
  // fact, and must not be presented as a list.
  if (authorizedDogIds.length === 0) {
    if (failedDogIds.length === 0 && forbiddenDogIds.length > 0) {
      return {
        state: {
          status: "forbidden",
          requiredCapability: CLINICAL_READ_CAPABILITY,
          message:
            "Nenhum registro clínico autorizado para o perfil de acesso atual.",
        },
        coverage,
      };
    }

    return {
      state: {
        status: "error",
        code: "CLINICAL_SCOPE_NO_AUTHORIZED_READ",
        message:
          "Não foi possível obter nenhuma leitura clínica confiável no escopo institucional.",
        technicalDetails: `forbidden=${forbiddenDogIds.length} failed=${failedDogIds.length} dogsInScope=${dogs.length}`,
        retryable: true,
      },
      coverage,
    };
  }

  if (coverageLoss) {
    // Mixed coverage — including "some cases + some denials" and
    // "authorized zero + some denials". Both are PARTIAL, never EMPTY.
    return {
      state: {
        status: "partial",
        partialData: sorted,
        failedSources,
        successfulSources,
      },
      coverage,
    };
  }

  if (sorted.length === 0) {
    // Proven institutional zero: full coverage, every authorized read empty.
    return {
      state: { status: "empty", query: `${CLINICAL_SCOPE_COLLECTION}/*/clinical_cases` },
      coverage,
    };
  }

  return {
    state: { status: "success", data: sorted, fetchedAt: new Date() },
    coverage,
  };
}
