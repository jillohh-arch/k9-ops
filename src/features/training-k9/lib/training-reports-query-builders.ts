/**
 * Real Firestore query constraint builders used by the Training Reports
 * provider.
 *
 * These functions are the SINGLE source of truth for the temporal +
 * pagination contract of the reports queries. Both the provider and
 * the regression tests import them — tests never re-implement the logic.
 *
 * Design notes:
 * - The builders accept `window: ResolvedReportWindow`. For `"all"` they
 *   apply only `orderBy + limit`; for `"bounded"` they apply
 *   `where("field", ">=", start)` followed by `orderBy` and `limit`; for
 *   `"invalid"` they refuse to build constraints and the provider must
 *   NOT call `getDocs`.
 * - We intentionally use `firebase/firestore` (NOT `@firebase/firestore`)
 *   and a plain JS `Date` (NOT a `Timestamp`) for the temporal value.
 *   This avoids the class-identity coupling that produced the `toMillis`
 *   runtime failure documented in the earlier reports.
 * - The builders receive a `makeConstraint` factory rather than importing
 *   SDK functions directly, so unit tests can exercise the decision tree
 *   WITHOUT loading the Firestore SDK. The provider passes the real
 *   factory from `firebase/firestore`.
 */

import type { ConstraintBuildResult, ResolvedReportWindow } from "../types/training-reports";

/**
 * Factory used to create the real SDK constraint objects.
 *
 * The provider injects the actual `where`, `orderBy`, and `limit` from
 * `firebase/firestore`. Tests inject a recording factory.
 */
export type ConstraintFactory = {
  where: (field: string, op: ">=", value: Date) => unknown;
  orderBy: (field: string, direction: "asc" | "desc") => unknown;
  limit: (count: number) => unknown;
};

/**
 * Build the constraints for a per-dog sessions query.
 *
 * Field: `started_at`, orderBy: `started_at desc`, limit: caller-supplied.
 */
export function buildSessionQueryConstraints(
  window: ResolvedReportWindow,
  sessionLimit: number,
  makeConstraint: ConstraintFactory,
): ConstraintBuildResult {
  if (window.kind === "invalid") {
    return { ok: false, error: "invalid-period", reason: window.reason };
  }

  const constraints: unknown[] = [];
  if (window.kind === "bounded") {
    constraints.push(makeConstraint.where("started_at", ">=", window.start));
  }
  constraints.push(makeConstraint.orderBy("started_at", "desc"));
  constraints.push(makeConstraint.limit(sessionLimit));

  return { ok: true, constraints };
}

/**
 * Build the constraints for the decided-evaluations query.
 *
 * Field: `decided_at`, orderBy: `decided_at desc`, limit: caller-supplied.
 */
export function buildDecidedEvaluationQueryConstraints(
  window: ResolvedReportWindow,
  decidedLimit: number,
  makeConstraint: ConstraintFactory,
): ConstraintBuildResult {
  if (window.kind === "invalid") {
    return { ok: false, error: "invalid-period", reason: window.reason };
  }

  const constraints: unknown[] = [];
  if (window.kind === "bounded") {
    constraints.push(makeConstraint.where("decided_at", ">=", window.start));
  }
  constraints.push(makeConstraint.orderBy("decided_at", "desc"));
  constraints.push(makeConstraint.limit(decidedLimit));

  return { ok: true, constraints };
}
