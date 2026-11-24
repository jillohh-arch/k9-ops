export type AuthorityState = "allowed" | "denied" | "unknown" | "conflicted";
export type Capability =
  | "vehicles.self_regularize_prior_occupancy"
  | "vehicles.exceptionally_reconcile_operational_engagement";

export interface TrustedIdentity { uid: string; ra: string; revision: number; active: boolean; confirmed: boolean; }
export interface IdentityBinding { uid: string; ra: string; active: boolean; confirmed: boolean; revision: number; }
export interface AuthorityEvidence { identity: TrustedIdentity; capability: Capability; grantRevision: number; authorityRevision: number; revocationRevision?: number; revokedAt?: string; designation?: "operational_inspector" | "supervisor"; evidenceRefs?: readonly string[]; justification?: string; idempotencyKey?: string; }
export interface CapabilityDecision { state: AuthorityState; capability: Capability; reason: string; evidence?: AuthorityEvidence; }
export interface AuthorityRevision { revision: number; issuedAt: string; status: "active" | "revoked"; supersedes?: number; revokedAt?: string; }
export interface CrewSchedule { scheduleId: string; revision: number; timezone: string; startLocal: string; endLocal: string; serviceDate: string; source: string; exceptionRef?: string; }
export interface CalculatedScheduleWindow { scheduleId: string; revision: number; timezone: string; serviceDate: string; start: Date; end: Date; inclusiveStart: true; exclusiveEnd: true; }
export interface ScheduleSnapshot extends Omit<CalculatedScheduleWindow, "start" | "end"> { start: string; end: string; snapshotId: string; source: string; createdAt: string; integrity: string; supersedesSnapshotId?: string; }
export interface SupersessionRecord { recordId: string; supersededSnapshotId: string; replacementSnapshotId: string; reason: string; createdAt: string; createdBy: string; }
export interface F40Eligibility { activeMembership: boolean; confirmed: boolean; incomingCrewMember: boolean; generation: string; }
export interface TrustedIdentityAdapter { resolveTrustedIdentity(input: { uid: string; ra?: string }): Promise<TrustedIdentity | null>; }
export interface AuthorityAdapter { evaluateCapability(input: { identity: TrustedIdentity; capability: Capability; evidence?: AuthorityEvidence; f40?: F40Eligibility }): Promise<CapabilityDecision>; assertAuthorityRevision(input: { expected: number; current: AuthorityRevision }): CapabilityDecision; }
