import type { IdentityBinding, TrustedIdentity } from './contracts';

const UID = /^[A-Za-z0-9:_-]{3,128}$/;
const RA = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
export function normalizeUid(value: unknown): string | null { const v = typeof value === 'string' ? value.trim() : ''; return UID.test(v) ? v : null; }
export function normalizeRa(value: unknown): string | null { const v = typeof value === 'string' ? value.trim().toUpperCase() : ''; return RA.test(v) ? v : null; }
export function validateIdentityBinding(input: Partial<IdentityBinding>): IdentityBinding {
  const uid = normalizeUid(input.uid), ra = normalizeRa(input.ra);
  const revision = input.revision;
  if (!uid || !ra || input.active !== true || input.confirmed !== true || typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) throw new Error('invalid_identity_binding');
  return { uid, ra, active: true, confirmed: true, revision };
}
export function resolveUniqueBinding(bindings: readonly IdentityBinding[], uid: string, requestedRa?: string): TrustedIdentity | null {
  const normalizedUid = normalizeUid(uid); if (!normalizedUid) return null;
  const active = bindings.filter((b) => b.active);
  if (active.some((b) => !normalizeUid(b.uid) || !normalizeRa(b.ra) || b.confirmed !== true || !Number.isInteger(b.revision) || b.revision < 1)) return null;
  const normalized = active.map((b) => ({ ...b, uid: normalizeUid(b.uid)!, ra: normalizeRa(b.ra)! }));
  const matches = normalized.filter((b) => b.uid === normalizedUid);
  if (matches.length !== 1) return null;
  const binding = matches[0];
  if (normalized.filter((b) => b.ra === binding.ra).length !== 1) return null;
  if (requestedRa !== undefined && normalizeRa(requestedRa) !== binding.ra) return null;
  return { uid: binding.uid, ra: binding.ra, revision: binding.revision, active: true, confirmed: true };
}
export const resolveTrustedIdentity = resolveUniqueBinding;
export function validateBindingUniqueness(bindings: readonly IdentityBinding[]): boolean {
  const active = bindings.filter((b) => b.active);
  return new Set(active.map((b) => normalizeUid(b.uid))).size === active.length && new Set(active.map((b) => normalizeRa(b.ra))).size === active.length && active.every((b) => normalizeUid(b.uid) !== null && normalizeRa(b.ra) !== null);
}
