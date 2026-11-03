/**
 * Runtime Authority Boundary — NON-AUTHORIZING structural contract.
 *
 * This module describes the evidence shape a future Mobile Functions authority
 * adapter must obtain from trusted server-controlled sources. It is NOT a grant
 * writer, NOT an identity store, and NOT deployed authorization logic.
 *
 * CRITICAL: A structurally valid payload is NOT automatically trusted.
 * No client-provided value (including a `trusted: true` field on the envelope)
 * can substitute for server verification. The only path to an "allowed" outcome
 * requires an explicit ServerAttestation object that a real server adapter would
 * supply after independently verifying the binding, grant, and schedule against
 * authoritative records.
 */

import type { Capability, CrewSchedule, F40Eligibility, ScheduleSnapshot, TrustedIdentity } from './contracts';

// ---------------------------------------------------------------------------
// Ratified capability identifiers (exact strings, no implicit grants)
// ---------------------------------------------------------------------------

export const SELF_REGULARIZE: Capability = 'vehicles.self_regularize_prior_occupancy';
export const EXCEPTIONAL_RECONCILE: Capability = 'vehicles.exceptionally_reconcile_operational_engagement';

// ---------------------------------------------------------------------------
// Decision states
// ---------------------------------------------------------------------------

export type BoundaryDecisionState =
  | 'structurally_valid_but_untrusted'
  | 'untrusted_missing_source'
  | 'denied_missing_binding'
  | 'denied_identity_not_active_confirmed'
  | 'denied_ambiguous_binding'
  | 'denied_grant_absent_or_revoked'
  | 'denied_stale_authority'
  | 'denied_capability_not_granted'
  | 'denied_designation_missing'
  | 'denied_schedule_missing'
  | 'denied_schedule_not_authoritative'
  | 'allowed_only_with_server_attestation';

// ---------------------------------------------------------------------------
// Envelope — structurally describable evidence
// ---------------------------------------------------------------------------

export interface ActorBindingEvidence {
  uid: string;
  ra: string;
  revision: number;
  active: boolean;
  confirmed: boolean;
}

export interface GrantEvidence {
  capability: Capability;
  grantRevision: number;
  authorityRevision: number;
  revocationRevision?: number;
  revokedAt?: string;
  designation?: 'operational_inspector' | 'supervisor';
  evidenceRefs?: readonly string[];
  justification?: string;
}

export interface ScheduleEvidence {
  snapshotId: string;
  revision: number;
  serviceDate: string;
  timezone: string;
  start: string;
  end: string;
  source: string;
  integrity: string;
}

export interface AuthorityEnvelope {
  actor: ActorBindingEvidence;
  grant: GrantEvidence;
  f40: F40Eligibility;
  schedule: ScheduleEvidence;
  /** Ignored for authority decisions — present only to verify it cannot grant access. */
  trusted?: unknown;
}

// ---------------------------------------------------------------------------
// Server attestation — the ONLY path to authorization
// ---------------------------------------------------------------------------

export const SERVER_ATTESTATION_REQUIRED = Symbol('SERVER_ATTESTATION_REQUIRED');

export interface ServerAttestation {
  /** Opaque server-side verification token. */
  verificationToken: string;
  /** ISO-8601 instant when the server performed its verification. */
  verifiedAt: string;
  /** Server-reported authority revision at time of verification. */
  authorityRevision: number;
  /** Server-reported schedule snapshot id at time of verification. */
  scheduleSnapshotId: string;
  /** Server-reported identity binding revision at time of verification. */
  identityBindingRevision: number;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface StructuralResult {
  valid: boolean;
  errors: readonly string[];
}

export interface AuthorityBoundaryDecision {
  state: BoundaryDecisionState;
  reason: string;
  structuralResult: StructuralResult;
  attestationPresent: boolean;
}

// ---------------------------------------------------------------------------
// Structural validity — shape and internal consistency only
// ---------------------------------------------------------------------------

const UID_PATTERN = /^[A-Za-z0-9:_-]{3,128}$/;
const RA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function validateActor(errors: string[], actor: ActorBindingEvidence): void {
  if (!UID_PATTERN.test(actor.uid)) errors.push('invalid_uid_format');
  if (!RA_PATTERN.test(actor.ra)) errors.push('invalid_ra_format');
  if (!Number.isInteger(actor.revision) || actor.revision < 1) errors.push('invalid_binding_revision');
  if (typeof actor.active !== 'boolean') errors.push('missing_active_flag');
  if (typeof actor.confirmed !== 'boolean') errors.push('missing_confirmed_flag');
}

function validateGrant(errors: string[], grant: GrantEvidence): void {
  if (grant.capability !== SELF_REGULARIZE && grant.capability !== EXCEPTIONAL_RECONCILE) {
    errors.push('unknown_capability');
  }
  if (!Number.isInteger(grant.grantRevision) || grant.grantRevision < 1) errors.push('invalid_grant_revision');
  if (!Number.isInteger(grant.authorityRevision) || grant.authorityRevision < 1) errors.push('invalid_authority_revision');
  if (grant.authorityRevision < grant.grantRevision) errors.push('authority_revision_before_grant');
  if (grant.revocationRevision !== undefined && (!Number.isInteger(grant.revocationRevision) || grant.revocationRevision < 1)) {
    errors.push('invalid_revocation_revision');
  }
}

function validateF40(errors: string[], f40: F40Eligibility): void {
  if (typeof f40.activeMembership !== 'boolean') errors.push('missing_f40_active_membership');
  if (typeof f40.confirmed !== 'boolean') errors.push('missing_f40_confirmed');
  if (typeof f40.incomingCrewMember !== 'boolean') errors.push('missing_f40_incoming_crew');
  if (!f40.generation || typeof f40.generation !== 'string') errors.push('missing_f40_generation');
}

function validateSchedule(errors: string[], schedule: ScheduleEvidence): void {
  if (!schedule.snapshotId || typeof schedule.snapshotId !== 'string') errors.push('missing_snapshot_id');
  if (!Number.isInteger(schedule.revision) || schedule.revision < 1) errors.push('invalid_schedule_revision');
  if (!ISO_DATE.test(schedule.serviceDate)) errors.push('invalid_service_date');
  if (!schedule.timezone || typeof schedule.timezone !== 'string') errors.push('missing_timezone');
  if (!ISO_INSTANT.test(schedule.start)) errors.push('invalid_start_instant');
  if (!ISO_INSTANT.test(schedule.end)) errors.push('invalid_end_instant');
  if (!schedule.source || typeof schedule.source !== 'string') errors.push('missing_schedule_source');
  if (!schedule.integrity || typeof schedule.integrity !== 'string') errors.push('missing_schedule_integrity');
  if (schedule.start >= schedule.end) errors.push('schedule_start_not_before_end');
}

export function evaluateStructuralValidity(input: AuthorityEnvelope): StructuralResult {
  const errors: string[] = [];
  if (!input.actor || typeof input.actor !== 'object') { errors.push('missing_actor'); return { valid: false, errors }; }
  validateActor(errors, input.actor);
  if (!input.grant || typeof input.grant !== 'object') { errors.push('missing_grant'); return { valid: false, errors }; }
  validateGrant(errors, input.grant);
  if (!input.f40 || typeof input.f40 !== 'object') { errors.push('missing_f40'); return { valid: false, errors }; }
  validateF40(errors, input.f40);
  if (!input.schedule || typeof input.schedule !== 'object') { errors.push('missing_schedule'); return { valid: false, errors }; }
  validateSchedule(errors, input.schedule);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Trusted authority evaluation — requires server attestation
// ---------------------------------------------------------------------------

export function evaluateTrustedAuthority(
  input: AuthorityEnvelope,
  attestation?: ServerAttestation | null,
): AuthorityBoundaryDecision {
  const structural = evaluateStructuralValidity(input);

  // No attestation => never authorized, regardless of structural validity.
  if (!attestation || !attestation.verificationToken || !attestation.verifiedAt) {
    return {
      state: structural.valid ? 'structurally_valid_but_untrusted' : 'untrusted_missing_source',
      reason: structural.valid ? 'no_server_attestation' : 'structural_invalid_and_no_attestation',
      structuralResult: structural,
      attestationPresent: false,
    };
  }

  // Structural failures fail closed even with attestation.
  if (!structural.valid) {
    return {
      state: 'untrusted_missing_source',
      reason: `structural_errors:${structural.errors.join(',')}`,
      structuralResult: structural,
      attestationPresent: true,
    };
  }

  const { actor, grant, f40, schedule } = input;

  // Identity must be active and confirmed.
  if (!actor.active || !actor.confirmed) {
    return decision('denied_identity_not_active_confirmed', 'identity_not_active_or_confirmed', structural);
  }

  // Binding revision must match attestation.
  if (actor.revision !== attestation.identityBindingRevision) {
    return decision('denied_stale_authority', 'binding_revision_mismatch', structural);
  }

  // Grant must not be revoked.
  if (grant.revokedAt || (grant.revocationRevision !== undefined && grant.revocationRevision >= grant.grantRevision)) {
    return decision('denied_grant_absent_or_revoked', 'grant_revoked', structural);
  }

  // Authority revision must match attestation.
  if (grant.authorityRevision !== attestation.authorityRevision) {
    return decision('denied_stale_authority', 'authority_revision_mismatch', structural);
  }

  // F40 eligibility required.
  if (!f40.activeMembership || !f40.confirmed || !f40.incomingCrewMember || !f40.generation) {
    return decision('denied_capability_not_granted', 'f40_eligibility_incomplete', structural);
  }

  // Exceptional reconciliation requires explicit designation.
  if (grant.capability === EXCEPTIONAL_RECONCILE) {
    if (!grant.designation || !grant.justification?.trim() || !grant.evidenceRefs?.length || grant.evidenceRefs.some((r) => !r.trim())) {
      return decision('denied_designation_missing', 'exceptional_reconciliation_requires_designation_evidence_justification', structural);
    }
  }

  // Schedule snapshot must match attestation.
  if (schedule.snapshotId !== attestation.scheduleSnapshotId) {
    return decision('denied_schedule_not_authoritative', 'schedule_snapshot_mismatch', structural);
  }

  return {
    state: 'allowed_only_with_server_attestation',
    reason: 'server_verified_all_evidence',
    structuralResult: structural,
    attestationPresent: true,
  };
}

function decision(state: BoundaryDecisionState, reason: string, structural: StructuralResult): AuthorityBoundaryDecision {
  return { state, reason, structuralResult: structural, attestationPresent: true };
}