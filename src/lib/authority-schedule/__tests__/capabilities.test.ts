import { describe, expect, it } from 'vitest';
import { evaluateCapability, EXCEPTIONAL_RECONCILE, SELF_REGULARIZE } from '../capabilities';
import { resolveUniqueBinding } from '../identity';
const identity = { uid:'uid-1', ra:'123', revision:1, active:true, confirmed:true };
const f40 = { activeMembership:true, confirmed:true, incomingCrewMember:true, generation:'g1' };
const evidence = { identity, capability:SELF_REGULARIZE, grantRevision:1, authorityRevision:1 };
describe('explicit capabilities', () => {
  it('allows self-regularization with F10 and F40 evidence', () => expect(evaluateCapability({ identity, capability:SELF_REGULARIZE, evidence, f40 }).state).toBe('allowed'));
  it('rejects role-only authorization and missing incoming crew eligibility', () => {
    expect(evaluateCapability({ identity, capability:'gestor' }).state).toBe('denied');
    expect(evaluateCapability({ identity, capability:SELF_REGULARIZE, evidence, f40:{...f40,incomingCrewMember:false} }).state).toBe('unknown');
  });
  it('requires designation, evidence and justification for exceptional reconciliation', () => {
    const exceptional = { ...evidence, capability:EXCEPTIONAL_RECONCILE };
    expect(evaluateCapability({ identity, capability:EXCEPTIONAL_RECONCILE, evidence:exceptional, f40 }).state).toBe('denied');
    expect(evaluateCapability({ identity, capability:EXCEPTIONAL_RECONCILE, evidence:{...exceptional,designation:'supervisor',evidenceRefs:['e1'],justification:'reconciliation'}, f40 }).state).toBe('allowed');
  });
  it('denies a revoked grant', () => expect(evaluateCapability({ identity, capability:SELF_REGULARIZE, evidence:{...evidence,revocationRevision:1}, f40 }).state).toBe('denied'));
  it('cannot authorize an actor whose source binding is unconfirmed', () => {
    const resolved = resolveUniqueBinding([{ uid: 'uid-1', ra: '123', active: true, confirmed: false, revision: 1 }], 'uid-1');
    expect(resolved).toBeNull();
    expect(evaluateCapability({ identity: resolved ?? undefined, capability: SELF_REGULARIZE, evidence, f40 }).state).toBe('unknown');
  });
});
