/**
 * Edit K9 V1 — narrow Web adapter for the homologated identity patch.
 *
 * Replaces the legacy Edit path, which spread the whole `K9FormValues`
 * snapshot into `adminUpsertK9` and could therefore overwrite Health,
 * Binomial, Training, specialties or lifecycle state.
 *
 * Structural guarantees:
 * - only the 10 allowlisted identity fields can reach the callable;
 * - omitted field means PRESERVE (never re-sent);
 * - clearing is explicit through `clearFields`; `null` is never transmitted;
 * - required identity fields can never be cleared;
 * - concurrency authority is max(updated_at, updatedAt) — never `??`.
 *
 * Non-identity fields are still editable in the legacy form until the E6
 * redesign, so a change to any of them fails closed locally instead of being
 * silently discarded.
 */

import {
  callAdminPatchK9Identity,
  type AdminPatchK9IdentityClearableField,
  type AdminPatchK9IdentityField,
} from "@/lib/firebase/functions";
import { canônicalizeModalities } from "@/features/effective/lib/k9-modalities";
import type { K9FormValues } from "@/features/effective/data/k9-admin-service";

/** Exactly the administrative identity surface accepted by the backend. */
export type K9EditIdentityValues = {
  birthDate: string;
  breed: string;
  color: string;
  microchip: string;
  name: string;
  notes: string;
  profileImageUrl: string;
  registrationNumber: string;
  sex: string;
  size: string;
};

export const K9_EDIT_IDENTITY_FIELDS = [
  "name",
  "registrationNumber",
  "breed",
  "sex",
  "birthDate",
  "color",
  "microchip",
  "size",
  "notes",
  "profileImageUrl",
] as const satisfies readonly AdminPatchK9IdentityField[];

/** Required identity fields — never eligible for clearFields. */
export const K9_EDIT_REQUIRED_FIELDS = [
  "name",
  "registrationNumber",
  "breed",
  "sex",
  "birthDate",
] as const;

/** Optional identity fields that the backend accepts in clearFields. */
export const K9_EDIT_CLEARABLE_FIELDS = [
  "color",
  "microchip",
  "size",
  "notes",
  "profileImageUrl",
] as const satisfies readonly AdminPatchK9IdentityClearableField[];

/**
 * Fields that live in the legacy form but belong to other domains. The backend
 * rejects each of them; the Edit path must never transmit them and must not
 * pretend to have saved them.
 */
export const K9_EDIT_NON_IDENTITY_FIELDS = [
  "operationalStatus",
  "weight",
  "idealWeightMin",
  "idealWeightMax",
  "physicalCondition",
  "conductorRa",
  "specialties",
] as const;

export type K9EditNonIdentityField = (typeof K9_EDIT_NON_IDENTITY_FIELDS)[number];

export type K9EditErrorCategory =
  | "ALREADY_EXISTS"
  | "INVALID_ARGUMENT"
  | "NON_IDENTITY_DIRTY"
  | "PERMISSION_DENIED"
  | "PRECONDITION_FAILED"
  | "REQUIRED_FIELD_MISSING"
  | "UNAUTHENTICATED"
  | "UNKNOWN";

/**
 * Typed adapter error. Preserves the original callable `code`/`message` so the
 * E6 conflict experience can re-read the K9 and decide, without this layer
 * matching on backend prose.
 */
export class K9EditError extends Error {
  readonly category: K9EditErrorCategory;
  readonly code: string | null;
  readonly dirtyFields: K9EditNonIdentityField[];
  readonly originalMessage: string;

  constructor(
    category: K9EditErrorCategory,
    message: string,
    options: {
      code?: string | null;
      dirtyFields?: K9EditNonIdentityField[];
      originalMessage?: string;
    } = {},
  ) {
    super(message);
    this.name = "K9EditError";
    this.category = category;
    this.code = options.code ?? null;
    this.dirtyFields = options.dirtyFields ?? [];
    this.originalMessage = options.originalMessage ?? message;
  }
}

/** Narrows an unknown timestamp-ish value to epoch millis. */
function timestampMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  const candidate = value as { toDate?: unknown; toMillis?: unknown };
  if (typeof candidate.toMillis === "function") {
    const millis = (candidate.toMillis as () => number)();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof candidate.toDate === "function") {
    const asDate = (candidate.toDate as () => Date)();
    return Number.isNaN(asDate.getTime()) ? null : asDate.getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Concurrency authority for `dogs/{dogId}`: the NEWEST of the two timestamp
 * mirrors.
 *
 * Deliberately NOT `updated_at ?? updatedAt` (nor the reverse). Gate E2 proved
 * that reading a single mirror accepts a stale precondition, because different
 * writers bump different mirrors: `generateNutritionAiInsight` writes only
 * `updated_at`, while mobile `dog_service.dart` writes only `updatedAt`.
 */
export function resolveK9VersionToken(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data) return null;
  const candidates = [
    timestampMillis(data.updated_at),
    timestampMillis(data.updatedAt),
  ].filter((value): value is number => value !== null);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Explicit projection of the legacy form snapshot onto the identity surface.
 * Each property is selected by name on purpose: no spread crosses this
 * boundary, so a new `K9FormValues` field cannot silently reach the callable.
 */
export function projectK9EditIdentity(
  values: K9FormValues,
): K9EditIdentityValues {
  return {
    birthDate: values.birthDate,
    breed: values.breed,
    color: values.color,
    microchip: values.microchip,
    name: values.name,
    notes: values.notes,
    profileImageUrl: values.profileImageUrl,
    registrationNumber: values.registrationNumber,
    sex: values.sex,
    size: values.size,
  };
}

function normalizeIdentityValue(field: keyof K9EditIdentityValues, raw: string) {
  const value = typeof raw === "string" ? raw : "";
  // birthDate stays YYYY-MM-DD; the timezone finding is deferred to a shared
  // Create/Edit gate and must not be "fixed" only on the Edit side.
  return field === "birthDate" ? value.trim() : value.trim();
}

function normalizeSpecialties(values: string[] | undefined) {
  if (!Array.isArray(values)) return [] as string[];
  return [...canônicalizeModalities(values)].sort();
}

/**
 * Detects changes to fields the identity patch cannot persist.
 *
 * Returning a non-empty list must abort the save: silently dropping these
 * would report success while discarding the operator's input.
 */
export function findNonIdentityDirtyFields(
  baseline: K9FormValues,
  current: K9FormValues,
): K9EditNonIdentityField[] {
  const dirty: K9EditNonIdentityField[] = [];
  for (const field of K9_EDIT_NON_IDENTITY_FIELDS) {
    if (field === "specialties") {
      const before = normalizeSpecialties(baseline.specialties);
      const after = normalizeSpecialties(current.specialties);
      if (before.length !== after.length ||
        before.some((item, index) => item !== after[index])) {
        dirty.push(field);
      }
      continue;
    }
    const before = String(baseline[field] ?? "").trim();
    const after = String(current[field] ?? "").trim();
    if (before !== after) dirty.push(field);
  }
  return dirty;
}

export type K9IdentityPatchPlan = {
  clearFields: AdminPatchK9IdentityClearableField[];
  patch: Partial<Record<AdminPatchK9IdentityField, string>>;
};

const CLEARABLE_SET = new Set<string>(K9_EDIT_CLEARABLE_FIELDS);
const REQUIRED_SET = new Set<string>(K9_EDIT_REQUIRED_FIELDS);

/**
 * Baseline-vs-current diff. No snapshot remerge: unchanged fields are omitted
 * entirely so the backend preserves them.
 */
export function buildK9IdentityPatch(
  baseline: K9EditIdentityValues,
  current: K9EditIdentityValues,
): K9IdentityPatchPlan {
  const patch: Partial<Record<AdminPatchK9IdentityField, string>> = {};
  const clearFields: AdminPatchK9IdentityClearableField[] = [];

  for (const field of K9_EDIT_IDENTITY_FIELDS) {
    const before = normalizeIdentityValue(field, baseline[field]);
    const after = normalizeIdentityValue(field, current[field]);

    if (after.length === 0 && REQUIRED_SET.has(field)) {
      // Fail closed even if the form-level validation was bypassed.
      throw new K9EditError(
        "REQUIRED_FIELD_MISSING",
        `O campo obrigatório "${field}" não pode ficar vazio.`,
      );
    }
    if (before === after) continue;
    if (after.length === 0) {
      if (!CLEARABLE_SET.has(field)) {
        throw new K9EditError(
          "REQUIRED_FIELD_MISSING",
          `O campo "${field}" não pode ser limpo.`,
        );
      }
      clearFields.push(field as AdminPatchK9IdentityClearableField);
      continue;
    }
    patch[field] = after;
  }

  return { clearFields, patch };
}

function callableCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Maps a callable failure onto a typed category, preserving code and message.
 *
 * `FAILED_PRECONDITION` covers BOTH stale concurrency and archived K9 in the
 * homologated backend. It is deliberately mapped to a single
 * `PRECONDITION_FAILED` category: distinguishing by message substring would
 * couple the Web to backend prose. E6 resolves it by re-reading the K9.
 */
export function mapK9EditCallableError(error: unknown): K9EditError {
  if (error instanceof K9EditError) return error;
  const rawCode = callableCode(error);
  const normalized = (rawCode ?? "").toLowerCase().replace(/^functions\//, "");
  const message =
    error instanceof Error && error.message ? error.message : "Falha ao salvar.";

  const category: K9EditErrorCategory =
    normalized === "unauthenticated"
      ? "UNAUTHENTICATED"
      : normalized === "permission-denied"
        ? "PERMISSION_DENIED"
        : normalized === "invalid-argument"
          ? "INVALID_ARGUMENT"
          : normalized === "failed-precondition"
            ? "PRECONDITION_FAILED"
            : normalized === "already-exists"
              ? "ALREADY_EXISTS"
              : "UNKNOWN";

  return new K9EditError(category, message, {
    code: rawCode,
    originalMessage: message,
  });
}

export type K9IdentitySaveResult = {
  clearedFields: string[];
  id: string;
  noop: boolean;
  updatedFields: string[];
};

/**
 * Sends the identity patch for an already-loaded K9.
 *
 * `currentValues.profileImageUrl` must already hold the uploaded URL when a new
 * photo was chosen; this adapter performs no Storage work.
 */
export async function patchK9Identity({
  baselineValues,
  currentValues,
  dogId,
  versionToken,
}: {
  baselineValues: K9FormValues;
  currentValues: K9FormValues;
  dogId: string;
  versionToken: number | null;
}): Promise<K9IdentitySaveResult> {
  if (!dogId) {
    throw new K9EditError("INVALID_ARGUMENT", "K9 não identificado para edição.");
  }

  const dirtyFields = findNonIdentityDirtyFields(baselineValues, currentValues);
  if (dirtyFields.length > 0) {
    throw new K9EditError(
      "NON_IDENTITY_DIRTY",
      "Peso, condição física, condutor, modalidades e situação cadastral pertencem a outros módulos e não podem ser alterados pela edição administrativa de identidade. Desfaça essas alterações para salvar a identidade.",
      { dirtyFields },
    );
  }

  const plan = buildK9IdentityPatch(
    projectK9EditIdentity(baselineValues),
    projectK9EditIdentity(currentValues),
  );

  const hasPatch = Object.keys(plan.patch).length > 0;
  const hasClear = plan.clearFields.length > 0;
  if (!hasPatch && !hasClear) {
    // Nothing to persist: do not invoke the backend, do not create an audit log.
    return { clearedFields: [], id: dogId, noop: true, updatedFields: [] };
  }

  try {
    const response = await callAdminPatchK9Identity({
      dogId,
      expectedUpdatedAt: versionToken,
      ...(hasPatch ? { patch: plan.patch } : {}),
      ...(hasClear ? { clearFields: plan.clearFields } : {}),
    });
    return {
      clearedFields: response.data?.clearedFields ?? plan.clearFields,
      id: response.data?.id ?? dogId,
      noop: false,
      updatedFields: response.data?.updatedFields ?? Object.keys(plan.patch),
    };
  } catch (error) {
    throw mapK9EditCallableError(error);
  }
}
