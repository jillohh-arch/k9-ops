import type { AuthorityAdapter, Capability, F40Eligibility, TrustedIdentityAdapter } from './contracts';
import { evaluateCapability } from './capabilities';
export { evaluateCapability };
import { assertAuthorityRevision } from './authority-revisions';
export function localAuthorityAdapter(): AuthorityAdapter { return { evaluateCapability: async i => evaluateCapability(i), assertAuthorityRevision: i => assertAuthorityRevision(i.expected, i.current) }; }
export type F10Adapters = { identity: TrustedIdentityAdapter; authority: AuthorityAdapter };
export type CapabilityInput = { capability: Capability; f40?: F40Eligibility };
