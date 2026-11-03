import { describe, expect, it } from 'vitest';
import { assertAuthorityRevision } from '../authority-revisions';
describe('authority revisions', () => {
  it('fails closed for missing, stale and revoked authority', () => {
    expect(assertAuthorityRevision(undefined,undefined).state).toBe('unknown');
    expect(assertAuthorityRevision(1,{revision:2,issuedAt:'x',status:'active'}).state).toBe('conflicted');
    expect(assertAuthorityRevision(1,{revision:1,issuedAt:'x',status:'revoked',revokedAt:'y'}).state).toBe('denied');
  });
});
