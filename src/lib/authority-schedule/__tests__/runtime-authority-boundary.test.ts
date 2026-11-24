import { describe, expect, it } from 'vitest';
import type { AuthorityEnvelope, ServerAttestation } from '../runtime-authority-boundary';
import { evaluateStructuralValidity, evaluateTrustedAuthority, EXCEPTIONAL_RECONCILE, SELF_REGULARIZE } from '../runtime-authority-boundary';

const validActor = { uid: 'uid-1', ra: 'RA01', revision: 1, active: true, confirmed: true };
const validGrant = { capability: SELF_REGULARIZE, grantRevision: 1, authorityRevision: 1 };
const validF40 = { activeMembership: true, confirmed: true, incomingCrewMember: true, generation: 'g1' };
const validSchedule = { snapshotId: 'snap-1', revision: 1, serviceDate: '2026-01-15', timezone: 'America/Sao_Paulo', start: '2026-01-15T08:00:00Z', end: '2026-01-15T17:00:00Z', source: 'server', integrity: 'abc' };
const validEnvelope: AuthorityEnvelope = { actor: validActor, grant: validGrant, f40: validF40, schedule: validSchedule };
const validAttestation: ServerAttestation = { verificationToken: 'tok-1', verifiedAt: '2026-01-15T07:00:00Z', authorityRevision: 1, scheduleSnapshotId: 'snap-1', identityBindingRevision: 1 };

describe('runtime-authority-boundary', () => {
  it('valid shape does not establish authority without server attestation', () => {
    const structural = evaluateStructuralValidity(validEnvelope);
    expect(structural.valid).toBe(true);
    const decision = evaluateTrustedAuthority(validEnvelope);
    expect(decision.state).toBe('structurally_valid_but_untrusted');
    expect(decision.attestationPresent).toBe(false);
  });

  it('missing actor binding fails closed', () => {
    const envelope = { ...validEnvelope, actor: undefined as unknown as AuthorityEnvelope['actor'] };
    expect(evaluateStructuralValidity(envelope).valid).toBe(false);
    expect(evaluateTrustedAuthority(envelope).state).toBe('untrusted_missing_source');
  });

  it('unconfirmed or inactive identity fails closed', () => {
    const inactive = { ...validEnvelope, actor: { ...validActor, active: false } };
    expect(evaluateTrustedAuthority(inactive, validAttestation).state).toBe('denied_identity_not_active_confirmed');
    const unconfirmed = { ...validEnvelope, actor: { ...validActor, confirmed: false } };
    expect(evaluateTrustedAuthority(unconfirmed, validAttestation).state).toBe('denied_identity_not_active_confirmed');
  });

  it('ambiguous binding fails closed (revision mismatch signals non-unique resolution)', () => {
    const mismatched = { ...validEnvelope, actor: { ...validActor, revision: 99 } };
    const decision = evaluateTrustedAuthority(mismatched, validAttestation);
    expect(decision.state).toBe('denied_stale_authority');
  });

  it('grant absent or revoked fails closed', () => {
    const revoked = { ...validEnvelope, grant: { ...validGrant, revocationRevision: 1, revokedAt: '2026-01-15T06:00:00Z' } };
    expect(evaluateTrustedAuthority(revoked, validAttestation).state).toBe('denied_grant_absent_or_revoked');
    const missingGrant = { ...validEnvelope, grant: undefined as unknown as AuthorityEnvelope['grant'] };
    expect(evaluateTrustedAuthority(missingGrant).state).toBe('untrusted_missing_source');
  });

  it('stale authority evidence fails closed', () => {
    const staleAttestation = { ...validAttestation, authorityRevision: 2 };
    const decision = evaluateTrustedAuthority(validEnvelope, staleAttestation);
    expect(decision.state).toBe('denied_stale_authority');
  });

  it('administrator without explicit vehicle grant fails closed', () => {
    const adminGrant = { ...validGrant, capability: 'admin' as unknown as typeof SELF_REGULARIZE };
    const envelope = { ...validEnvelope, grant: adminGrant };
    expect(evaluateStructuralValidity(envelope).valid).toBe(false);
    expect(evaluateTrustedAuthority(envelope, validAttestation).state).not.toBe('allowed_only_with_server_attestation');
  });

  it('exceptional reconciliation without express designation fails closed', () => {
    const exceptional = { ...validEnvelope, grant: { ...validGrant, capability: EXCEPTIONAL_RECONCILE } };
    const decision = evaluateTrustedAuthority(exceptional, validAttestation);
    expect(decision.state).toBe('denied_designation_missing');
    const withDesignation = { ...exceptional, grant: { ...exceptional.grant, designation: 'supervisor' as const, evidenceRefs: ['e1'], justification: 'reconciliation' } };
    expect(evaluateTrustedAuthority(withDesignation, validAttestation).state).toBe('allowed_only_with_server_attestation');
  });

  it('missing schedule authority fails closed', () => {
    const noSchedule = { ...validEnvelope, schedule: undefined as unknown as AuthorityEnvelope['schedule'] };
    expect(evaluateStructuralValidity(noSchedule).valid).toBe(false);
    expect(evaluateTrustedAuthority(noSchedule).state).toBe('untrusted_missing_source');
  });

  it('client-provided schedule is not automatically authoritative', () => {
    const mismatchedSchedule = { ...validEnvelope, schedule: { ...validSchedule, snapshotId: 'client-forged' } };
    const decision = evaluateTrustedAuthority(mismatchedSchedule, validAttestation);
    expect(decision.state).toBe('denied_schedule_not_authoritative');
  });

  it('forged trusted:true field does not yield authorization', () => {
    const forged = { ...validEnvelope, trusted: true };
    const structural = evaluateStructuralValidity(forged);
    expect(structural.valid).toBe(true);
    const decision = evaluateTrustedAuthority(forged);
    expect(decision.state).toBe('structurally_valid_but_untrusted');
    expect(decision.attestationPresent).toBe(false);
  });
});