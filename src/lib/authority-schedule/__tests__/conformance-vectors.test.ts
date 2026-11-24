import { describe, expect, it } from 'vitest';
import vectorsPayload from '../conformance-vectors.json';
import {
  resolveUniqueBinding,
  validateBindingUniqueness,
  validateIdentityBinding,
} from '../identity';
import { evaluateCapability } from '../capabilities';
import { calculateCrewWindow } from '../schedule';
import {
  buildSupersessionRecord,
  createSnapshot,
  verifySnapshot,
} from '../snapshots';
import { assertAuthorityRevision } from '../authority-revisions';
import type {
  AuthorityEvidence,
  AuthorityRevision,
  CalculatedScheduleWindow,
  CrewSchedule,
  F40Eligibility,
  IdentityBinding,
  ScheduleSnapshot,
  TrustedIdentity,
} from '../contracts';

interface SerializedScheduleWindow {
  scheduleId: string;
  revision: number;
  timezone: string;
  serviceDate: string;
  start: string;
  end: string;
  inclusiveStart: true;
  exclusiveEnd: true;
}

interface ConformanceVectorExpected {
  state?: string;
  result?: unknown;
  error?: string | null;
  reason?: string;
  capability?: string;
  durationMs?: number;
  startIso?: string;
  inclusiveStart?: boolean;
  exclusiveEnd?: boolean;
  verifyResult?: boolean;
  frozen?: boolean;
  supersededSnapshotId?: string;
}

type ConformanceVector =
  | {
      id: string;
      category: 'identity';
      source_function: 'resolveUniqueBinding';
      input: {
        bindings: IdentityBinding[];
        uid: string;
        requestedRa?: string;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'identity';
      source_function: 'validateBindingUniqueness';
      input: {
        bindings: IdentityBinding[];
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'identity';
      source_function: 'validateIdentityBinding';
      input: {
        binding: Partial<IdentityBinding>;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'capabilities';
      source_function: 'evaluateCapability';
      input: {
        identity?: TrustedIdentity;
        capability: unknown;
        evidence?: AuthorityEvidence;
        f40?: F40Eligibility;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'schedule';
      source_function: 'calculateCrewWindow';
      input: CrewSchedule;
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'snapshots';
      source_function: 'createSnapshot';
      input: {
        window?: SerializedScheduleWindow;
        source: string;
        snapshotId: string;
        createdAt: string;
        supersedesSnapshotId?: string;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'snapshots';
      source_function: 'verifySnapshot';
      input: {
        originalSource?: string;
        modifiedSource?: string;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'snapshots';
      source_function: 'buildSupersessionRecord';
      input: {
        oldSnapshot: ScheduleSnapshot;
        replacementSnapshot: ScheduleSnapshot;
        reason: string;
        createdBy: string;
        recordId: string;
        createdAt: string;
      };
      expected: ConformanceVectorExpected;
    }
  | {
      id: string;
      category: 'authority_revisions';
      source_function: 'assertAuthorityRevision';
      input: {
        expected?: number | null;
        current?: AuthorityRevision | null;
      };
      expected: ConformanceVectorExpected;
    };

describe('conformance vectors v1.1.0 suite integrity', () => {
  it('has version 1.1.0', () => {
    expect(vectorsPayload.version).toBe('1.1.0');
  });

  it('contains at least 39 conformance vectors with unique ids', () => {
    expect(vectorsPayload.vectors.length).toBeGreaterThanOrEqual(39);
    const ids = vectorsPayload.vectors.map((v) => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('conformance vectors execution', () => {
  for (const vector of vectorsPayload.vectors) {
    it(`executes vector: ${vector.id} (${vector.category})`, () => {
      const typedVector = vector as unknown as ConformanceVector;

      if (typedVector.category === 'identity') {
        if (typedVector.source_function === 'resolveUniqueBinding') {
          const { input, expected } = typedVector;
          const result = resolveUniqueBinding(
            input.bindings,
            input.uid,
            input.requestedRa,
          );
          if (expected.result === null) {
            expect(result).toBeNull();
          } else {
            expect(result).toEqual(expected.result);
          }
        } else if (typedVector.source_function === 'validateBindingUniqueness') {
          const { input, expected } = typedVector;
          const result = validateBindingUniqueness(input.bindings);
          expect(result).toBe(expected.result);
        } else if (typedVector.source_function === 'validateIdentityBinding') {
          const { input, expected } = typedVector;
          if (expected.error) {
            expect(() => validateIdentityBinding(input.binding)).toThrow(
              expected.error,
            );
          } else {
            expect(validateIdentityBinding(input.binding)).toEqual(
              expected.result,
            );
          }
        }
      } else if (typedVector.category === 'capabilities') {
        if (typedVector.source_function === 'evaluateCapability') {
          const { input, expected } = typedVector;
          const decision = evaluateCapability({
            identity: input.identity,
            capability: input.capability,
            evidence: input.evidence,
            f40: input.f40,
          });
          expect(decision.state).toBe(expected.state);
          if (expected.reason) {
            expect(decision.reason).toBe(expected.reason);
          }
          if (expected.capability) {
            expect(decision.capability).toBe(expected.capability);
          }
        }
      } else if (typedVector.category === 'schedule') {
        if (typedVector.source_function === 'calculateCrewWindow') {
          const { input, expected } = typedVector;
          if (expected.error) {
            expect(() => calculateCrewWindow(input)).toThrow(
              expected.error,
            );
          } else {
            const window = calculateCrewWindow(input);
            if (expected.durationMs !== undefined) {
              expect(window.end.getTime() - window.start.getTime()).toBe(
                expected.durationMs,
              );
            }
            if (expected.startIso !== undefined) {
              expect(window.start.toISOString()).toBe(expected.startIso);
            }
            if (expected.inclusiveStart !== undefined) {
              expect(window.inclusiveStart).toBe(expected.inclusiveStart);
            }
            if (expected.exclusiveEnd !== undefined) {
              expect(window.exclusiveEnd).toBe(expected.exclusiveEnd);
            }
          }
        }
      } else if (typedVector.category === 'snapshots') {
        if (typedVector.source_function === 'createSnapshot') {
          const { input, expected } = typedVector;
          if (expected.error) {
            expect(() =>
              createSnapshot(
                input.window
                  ? {
                      ...input.window,
                      start: new Date(input.window.start),
                      end: new Date(input.window.end),
                    }
                  : (undefined as unknown as CalculatedScheduleWindow),
                input.source,
                input.snapshotId,
                input.createdAt,
                input.supersedesSnapshotId,
              ),
            ).toThrow(expected.error);
          } else {
            expect(input.window).toBeDefined();
            if (!input.window) return;
            const snapshot = createSnapshot(
              {
                ...input.window,
                start: new Date(input.window.start),
                end: new Date(input.window.end),
              },
              input.source,
              input.snapshotId,
              input.createdAt,
              input.supersedesSnapshotId,
            );
            if (expected.verifyResult !== undefined) {
              expect(verifySnapshot(snapshot)).toBe(expected.verifyResult);
            }
            if (expected.frozen) {
              expect(Object.isFrozen(snapshot)).toBe(true);
            }
          }
        } else if (typedVector.source_function === 'verifySnapshot') {
          const { input, expected } = typedVector;
          if (input.originalSource && input.modifiedSource) {
            const win = {
              scheduleId: 's',
              revision: 1,
              timezone: 'UTC',
              serviceDate: '2026-11-01',
              start: new Date('2026-11-01T07:00:00.000Z'),
              end: new Date('2026-11-01T19:00:00.000Z'),
              inclusiveStart: true as const,
              exclusiveEnd: true as const,
            };
            const snap = createSnapshot(
              win,
              input.originalSource,
              's1',
              '2026-11-01T00:00:00Z',
            );
            const tampered = { ...snap, source: input.modifiedSource };
            expect(verifySnapshot(tampered)).toBe(expected.verifyResult);
          }
        } else if (typedVector.source_function === 'buildSupersessionRecord') {
          const { input, expected } = typedVector;
          if (expected.error) {
            expect(() =>
              buildSupersessionRecord(
                input.oldSnapshot,
                input.replacementSnapshot,
                input.reason,
                input.createdBy,
                input.recordId,
                input.createdAt,
              ),
            ).toThrow(expected.error);
          } else {
            const record = buildSupersessionRecord(
              input.oldSnapshot,
              input.replacementSnapshot,
              input.reason,
              input.createdBy,
              input.recordId,
              input.createdAt,
            );
            expect(record.supersededSnapshotId).toBe(
              expected.supersededSnapshotId,
            );
          }
        }
      } else if (typedVector.category === 'authority_revisions') {
        if (typedVector.source_function === 'assertAuthorityRevision') {
          const { input, expected } = typedVector;
          const decision = assertAuthorityRevision(
            input.expected ?? undefined,
            input.current ?? undefined,
          );
          expect(decision.state).toBe(expected.state);
          expect(decision.reason).toBe(expected.reason);
        }
      }
    });
  }
});
