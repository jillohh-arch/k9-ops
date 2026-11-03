import type { AuthorityEvidence, Capability, CapabilityDecision, F40Eligibility, TrustedIdentity } from './contracts';
export const SELF_REGULARIZE: Capability = 'vehicles.self_regularize_prior_occupancy';
export const EXCEPTIONAL_RECONCILE: Capability = 'vehicles.exceptionally_reconcile_operational_engagement';
export const EXCEPTIONALLY_RECONCILE = EXCEPTIONAL_RECONCILE;
export const RATIFIED_CAPABILITIES = [SELF_REGULARIZE, EXCEPTIONAL_RECONCILE] as const;
export function isCapability(value: unknown): value is Capability { return RATIFIED_CAPABILITIES.includes(value as Capability); }
export function evaluateCapability(input: { identity?: TrustedIdentity; capability: unknown; evidence?: AuthorityEvidence; f40?: F40Eligibility }): CapabilityDecision {
  if (!isCapability(input.capability)) return { state: 'denied', capability: SELF_REGULARIZE, reason: 'unknown_capability' };
  const capability = input.capability;
  const { identity, evidence, f40 } = input;
  if (!identity) return { state: 'unknown', capability, reason: 'trusted_identity_missing' };
  if (!identity.active || !identity.confirmed) return { state: 'denied', capability, reason: 'identity_not_active_confirmed' };
  if (!evidence || evidence.capability !== capability || evidence.identity.uid !== identity.uid || evidence.identity.ra !== identity.ra || !Number.isInteger(evidence.grantRevision) || evidence.grantRevision <= 0 || !Number.isInteger(evidence.authorityRevision) || evidence.authorityRevision < evidence.grantRevision) return { state: 'unknown', capability, reason: 'missing_or_untrusted_evidence' };
  if (evidence.revokedAt || (evidence.revocationRevision !== undefined && evidence.revocationRevision >= evidence.grantRevision)) return { state: 'denied', capability, reason: 'capability_revoked', evidence };
  if (!f40 || !f40.activeMembership || !f40.confirmed || !f40.incomingCrewMember || !f40.generation) return { state: 'unknown', capability, reason: 'f40_eligibility_missing', evidence };
  if (capability === EXCEPTIONAL_RECONCILE && (!evidence.designation || !evidence.justification?.trim() || !evidence.evidenceRefs?.length || evidence.evidenceRefs.some((ref) => !ref.trim()))) return { state: 'denied', capability, reason: 'designation_evidence_or_justification_missing', evidence };
  return { state: 'allowed', capability, reason: 'explicit_evidence_and_eligibility', evidence };
}
