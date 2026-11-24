import type { CalculatedScheduleWindow, CrewSchedule } from './contracts';
const time = (s: string) => { const m = /^(\d{2}):(\d{2})$/.exec(s); if (!m) return null; const h = Number(m[1]), min = Number(m[2]); return h < 24 && min < 60 ? [h, min] as const : null; };
function parts(date: Date, timezone: string): Record<string, number> {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  return Object.fromEntries(values.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}
function localInstant(dateText: string, localTime: string, timezone: string): Date {
  const [year, month, day] = dateText.split('-').map(Number); const [hour, minute] = localTime.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  const calendar = new Date(wall);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) throw new Error('invalid_service_date');
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = new Date(wall + hours * 3600000); const p = parts(sample, timezone);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample.getTime());
  }
  const candidates = [...offsets].map((offset) => new Date(wall - offset)).filter((candidate) => {
    const p = parts(candidate, timezone);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  });
  if (candidates.length !== 1) throw new Error(candidates.length === 0 ? 'nonexistent_local_time' : 'ambiguous_local_time');
  return candidates[0];
}
export function calculateCrewWindow(schedule: CrewSchedule): CalculatedScheduleWindow {
  if (!schedule.scheduleId || !Number.isInteger(schedule.revision) || schedule.revision < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.serviceDate)) throw new Error('invalid_schedule');
  try { new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone }).format(0); } catch { throw new Error('invalid_timezone'); }
  const st = time(schedule.startLocal), en = time(schedule.endLocal); if (!st || !en) throw new Error('invalid_local_time');
  const start = localInstant(schedule.serviceDate, schedule.startLocal, schedule.timezone);
  const startMinutes = st[0] * 60 + st[1], endMinutes = en[0] * 60 + en[1];
  const [year, month, day] = schedule.serviceDate.split('-').map(Number);
  const endDate = endMinutes <= startMinutes ? new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10) : schedule.serviceDate;
  const end = localInstant(endDate, schedule.endLocal, schedule.timezone);
  if (end <= start) throw new Error('invalid_schedule_interval');
  return { scheduleId: schedule.scheduleId, revision: schedule.revision, timezone: schedule.timezone, serviceDate: schedule.serviceDate, start, end, inclusiveStart: true, exclusiveEnd: true };
}
export function resolveEffectiveSchedule(input: { crewSchedule: CrewSchedule; memberSchedule?: CrewSchedule }): CrewSchedule {
  return input.crewSchedule;
}
