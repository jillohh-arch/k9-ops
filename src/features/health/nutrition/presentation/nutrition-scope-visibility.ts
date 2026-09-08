/**
 * K9 Ops Web — Health Web v1 / HW-6A.H1.FIX1
 * Nutrition landing scope visibility.
 *
 * PROBLEM
 * -------
 * The landing composes its K9 list from `loadReadinessScope()`, whose
 * institutional source is `dogs` — and `dogs/{dogId}` is readable by ANY signed
 * in user (`allow read: if signedIn()`). Every per-dog Health projection under
 * it, however, is gated by `canAccessDogRecord(dogId)`. So an `own_records`
 * persona legitimately sees the institutional roster but is NOT authorized to
 * inspect most of it. Offering those K9s as Nutrition options sends the operator
 * into a guaranteed `firestore-read-error`.
 *
 * WHY THE OBVIOUS CLIENT FILTER IS WRONG
 * --------------------------------------
 * Filtering on `dog.conductor.ra === myRa` does NOT reproduce
 * `canAccessDogRecord`, which authorizes through THREE disjuncts:
 *   1. `dogAssignedToAuth` accepts `conductorRa` OR `conductor_ra` OR
 *      `handlerId` OR `handler_id`; the shared `toDogIdentity` mapper reads
 *      ONLY `conductorRa`, so an assignment recorded under any alias maps to
 *      `conductor: null` and would be WRONGLY HIDDEN from its own handler.
 *   2. `activeShiftDogMatches` authorizes via `active_shifts/{ra}` — a document
 *      the Health read model never loads and cannot infer.
 *   3. Profile `scope`, which the client normalizes FAIL-OPEN
 *      (`raw.scope === "own_records" ? "own_records" : "global"`) and which
 *      ignores the `access_scope`/`accessScope` downgrade that Rules apply.
 *
 * Guessing any of those would weaken or over-restrict a reviewed boundary.
 *
 * THE AUTHORITY ACTUALLY USED HERE
 * --------------------------------
 * `loadReadinessScope()` already performs, per dog, a `health_summary/current`
 * read gated by exactly `canAccessDogRecord(dogId)`, and preserves the outcome
 * in `item.dataQuality`. A `permission-denied` verdict there IS the server's own
 * answer to "may this persona inspect this K9", so this module mirrors the
 * boundary instead of re-deriving it. No scope field, RA comparison or shift
 * lookup is consulted, and Security Rules remain the only authority.
 *
 * Consequences that make this safe by construction:
 * - under `global` scope no dog is ever denied, so nothing is filtered out;
 * - a technical failure is NEVER treated as a denial (see `classify`), because
 *   "unknown coverage" must not masquerade as "not authorized";
 * - denials and failures are counted SEPARATELY, matching the Clinical
 *   precedent, since they are different facts for the operator.
 */

import type { ReadState } from "../../domain/read-states";
import type { DogIdentityReadModel, ReadinessListItem } from "../../domain/readiness-types";

/**
 * Per-dog visibility verdict.
 *
 * - `authorized`   : the projection read produced a usable answer (data or a
 *                    proven zero) — the persona may inspect this K9.
 * - `unauthorized` : the projection read was denied by Rules — the persona may
 *                    NOT inspect this K9, so it must not be offered.
 * - `undetermined` : the read failed technically. Authority is UNKNOWN, never
 *                   assumed to be denial.
 */
export type NutritionDogVisibility = "authorized" | "unauthorized" | "undetermined";

/**
 * Detects a Firestore permission denial inside a preserved read state.
 *
 * The per-dog readers wrap the raw error into
 * `{ status: "error", code: "FIRESTORE_READ_ERROR", technicalDetails }`, so the
 * denial has to be recognised from the carried message/details rather than from
 * a live `FirebaseError`. Matching is deliberately narrow: anything that is not
 * recognisably a denial stays `undetermined`.
 */
export function isPermissionDeniedState(state: ReadState | undefined | null): boolean {
  if (!state || state.status !== "error") return false;

  const candidate = [
    (state as { code?: unknown }).code,
    (state as { message?: unknown }).message,
    (state as { technicalDetails?: unknown }).technicalDetails,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    candidate.includes("permission-denied") ||
    candidate.includes("permission_denied") ||
    candidate.includes("insufficient permissions")
  );
}

/**
 * Classifies one composed readiness item.
 *
 * `empty` is authorized on purpose: an authorized read that found no projection
 * is a proven zero, and the K9 must remain inspectable.
 */
export function classifyNutritionDogVisibility(
  item: Pick<ReadinessListItem, "dataQuality">,
): NutritionDogVisibility {
  const state = item.dataQuality;

  if (isPermissionDeniedState(state)) return "unauthorized";

  switch (state?.status) {
    case "success":
    case "empty":
    case "partial":
    case "degraded":
    case "stale":
    case "legacy":
      return "authorized";
    case "forbidden":
    case "unauthorized":
      return "unauthorized";
    case "error":
      // A non-denial error: coverage is unknown, NOT forbidden.
      return "undetermined";
    default:
      return "undetermined";
  }
}

/** Truthful accounting for what the landing list does and does not cover. */
export interface NutritionScopeVisibility {
  /** K9s present in the institutional scope read. */
  totalLoaded: number;
  /** K9s the persona may inspect — the ONLY ones rendered as options. */
  visibleDogs: DogIdentityReadModel[];
  /** `visibleDogs.length`, named for the gate's accounting contract. */
  authorizedCount: number;
  /** K9s withheld because Rules denied the projection read. */
  excludedCount: number;
  /** K9s whose authority could not be determined (technical failure). */
  undeterminedCount: number;
}

/**
 * Splits a loaded readiness scope into what may be offered and what may not.
 *
 * Input order is preserved; no dog is reordered, renamed or mutated.
 *
 * `undetermined` dogs are kept VISIBLE: withholding a K9 on a transport failure
 * would invent a denial the server never issued, and the existing per-dog error
 * handling already reports the failure honestly if the operator navigates.
 */
export function selectVisibleNutritionDogs(
  items: ReadinessListItem[],
): NutritionScopeVisibility {
  const visibleDogs: DogIdentityReadModel[] = [];
  let excludedCount = 0;
  let undeterminedCount = 0;

  for (const item of items) {
    const visibility = classifyNutritionDogVisibility(item);

    if (visibility === "unauthorized") {
      excludedCount += 1;
      continue;
    }

    if (visibility === "undetermined") {
      undeterminedCount += 1;
    }

    visibleDogs.push(item.dog);
  }

  return {
    totalLoaded: items.length,
    visibleDogs,
    authorizedCount: visibleDogs.length,
    excludedCount,
    undeterminedCount,
  };
}

/**
 * Operator-facing coverage sentence.
 *
 * PRIVACY: counts only. No id, name, matrícula or any other attribute of an
 * excluded K9 is ever included — the persona is not authorized to learn which
 * K9s exist outside its scope, only that the list is incomplete.
 */
export function describeNutritionExclusions(
  visibility: Pick<NutritionScopeVisibility, "excludedCount" | "undeterminedCount">,
): string | null {
  const parts: string[] = [];

  if (visibility.excludedCount > 0) {
    parts.push(
      `${visibility.excludedCount} ${
        visibility.excludedCount === 1 ? "K9 não autorizado" : "K9 não autorizados"
      }`,
    );
  }

  if (visibility.undeterminedCount > 0) {
    parts.push(
      `${visibility.undeterminedCount} ${
        visibility.undeterminedCount === 1
          ? "K9 com falha de leitura"
          : "K9 com falha de leitura"
      }`,
    );
  }

  return parts.length > 0 ? `Não incluído: ${parts.join(" · ")}.` : null;
}
