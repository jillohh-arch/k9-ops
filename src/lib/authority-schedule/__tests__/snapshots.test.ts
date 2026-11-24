import { describe, expect, it } from 'vitest';
import { calculateCrewWindow } from '../schedule';
import { buildSupersessionRecord, createSnapshot, verifySnapshot } from '../snapshots';
describe('immutable schedule snapshots', () => {
  it('preserves the original revision and verifies a versioned correction', () => {
    const window = calculateCrewWindow({scheduleId:'s',revision:1,timezone:'UTC',startLocal:'07:00',endLocal:'19:00',serviceDate:'2026-11-01',source:'crew'});
    const original = createSnapshot(window,'crew-assignment','s1','2026-11-01T00:00:00Z');
    const replacement = createSnapshot({...window,revision:2},'corrected-assignment','s2','2026-11-01T01:00:00Z','s1');
    expect(Object.isFrozen(original)).toBe(true); expect(verifySnapshot(original)).toBe(true);
    expect(buildSupersessionRecord(original,replacement,'corrected source','trusted-writer','sup-1','2026-11-01T01:00:00Z').supersededSnapshotId).toBe('s1');
    expect(original.revision).toBe(1); expect(verifySnapshot({...original,source:'rewritten'})).toBe(false);
  });
});
