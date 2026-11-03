import type { CalculatedScheduleWindow, ScheduleSnapshot, SupersessionRecord } from './contracts';
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function createSnapshot(window: CalculatedScheduleWindow, source: string, snapshotId: string, createdAt: string, supersedesSnapshotId?: string): ScheduleSnapshot {
  if (!source.trim() || !snapshotId.trim() || !createdAt.trim()) throw new Error('invalid_snapshot_metadata');
  const payload = { ...window, start: window.start.toISOString(), end: window.end.toISOString(), source, snapshotId, createdAt, ...(supersedesSnapshotId ? { supersedesSnapshotId } : {}) };
  const integrity = stable(payload);
  return Object.freeze({ ...payload, integrity });
}
export function verifySnapshot(snapshot: ScheduleSnapshot): boolean {
  const { integrity, ...payload } = snapshot;
  return snapshot.start < snapshot.end && integrity === stable(payload);
}
export function buildSupersessionRecord(oldSnapshot: ScheduleSnapshot, replacementSnapshot: ScheduleSnapshot, reason: string, createdBy: string, recordId: string, createdAt: string): SupersessionRecord {
  if (!reason.trim() || !createdBy.trim() || !recordId.trim() || !createdAt.trim() || oldSnapshot.snapshotId === replacementSnapshot.snapshotId || replacementSnapshot.supersedesSnapshotId !== oldSnapshot.snapshotId || replacementSnapshot.revision <= oldSnapshot.revision) throw new Error('invalid_supersession');
  return Object.freeze({ recordId, supersededSnapshotId: oldSnapshot.snapshotId, replacementSnapshotId: replacementSnapshot.snapshotId, reason, createdBy, createdAt });
}
