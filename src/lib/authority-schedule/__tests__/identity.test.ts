import { describe, expect, it } from 'vitest';
import { resolveUniqueBinding, validateIdentityBinding, validateBindingUniqueness } from '../identity';
const binding = (uid: string, ra: string) => ({ uid, ra, active: true, confirmed: true, revision: 1 });
describe('trusted identity contract', () => {
  it('resolves one active confirmed UID/RA pair', () => expect(resolveUniqueBinding([binding('uid-1','123')], 'uid-1')?.ra).toBe('123'));
  it('rejects duplicate UIDs and RAs, malformed data and caller RA mismatch', () => {
    expect(validateBindingUniqueness([binding('uid-1','123'), binding('uid-2','123')])).toBe(false);
    expect(resolveUniqueBinding([binding('uid-1','123'), binding('uid-1','124')], 'uid-1')).toBeNull();
    expect(resolveUniqueBinding([binding('uid-1','123')], 'uid-1', '999')).toBeNull();
    expect(() => validateIdentityBinding({ uid:'', ra:'123', active:true, confirmed:true, revision:1 })).toThrow();
  });
  it('fails closed for inactive identity bindings', () => expect(resolveUniqueBinding([{...binding('uid-1','123'), active:false}], 'uid-1')).toBeNull());
  it('rejects an active but unconfirmed binding without manufacturing trust', () => {
    expect(resolveUniqueBinding([{ uid: 'uid-1', ra: '123', active: true, confirmed: false, revision: 1 }], 'uid-1')).toBeNull();
  });
  it('rejects an active binding with missing confirmation', () => {
    const source = { uid: 'uid-1', ra: '123', active: true, revision: 1 } as Parameters<typeof resolveUniqueBinding>[0][number];
    expect(resolveUniqueBinding([source], 'uid-1')).toBeNull();
  });
  it('rejects malformed active records even when another binding is confirmed', () => {
    expect(resolveUniqueBinding([
      binding('uid-1', '123'),
      { uid: 'uid-2', ra: '124', active: true, confirmed: false, revision: 1 },
    ], 'uid-1')).toBeNull();
  });
});
