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
      const { category, input, expected, source_function } = vector as any;

      if (category === 'identity') {
        if (source_function === 'resolveUniqueBinding') {
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
        } else if (source_function === 'validateBindingUniqueness') {
          const result = validateBindingUniqueness(input.bindings);
          expect(result).toBe(expected.result);
        } else if (source_function === 'validateIdentityBinding') {
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
      } else if (category === 'capabilities') {
        if (source_function === 'evaluateCapability') {
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
      } else if (category === 'schedule') {
        if (source_function === 'calculateCrewWindow') {
          if (expected.error) {
            expect(() => calculateCrewWindow(input as any)).toThrow(
              expected.error,
            );
          } else {
            const window = calculateCrewWindow(input as any);
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
      } else if (category === 'snapshots') {
        if (source_function === 'createSnapshot') {
          if (expected.error) {
            expect(() =>
              createSnapshot(
                input.window
                  ? {
                      ...input.window,
                      start: new Date(input.window.start),
                      end: new Date(input.window.end),
                    }
                  : (undefined as any),
                input.source,
                input.snapshotId,
                input.createdAt,
                input.supersedesSnapshotId,
              ),
            ).toThrow(expected.error);
          } else {
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
        } else if (source_function === 'verifySnapshot') {
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
        } else if (source_function === 'buildSupersessionRecord') {
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
      } else if (category === 'authority_revisions') {
        if (source_function === 'assertAuthorityRevision') {
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
