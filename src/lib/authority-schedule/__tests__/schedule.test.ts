import { describe, expect, it } from 'vitest';
import { calculateCrewWindow } from '../schedule';
const input = (startLocal:string,endLocal:string,timezone='America/Sao_Paulo',serviceDate='2026-11-01') => ({ scheduleId:'crew-day',revision:2,timezone,startLocal,endLocal,serviceDate,source:'crew-assignment' });
describe('crew schedule calculation', () => {
  it('calculates same-day and overnight crew windows', () => {
    const day = calculateCrewWindow(input('07:00','19:00')); expect(day.end.getTime()-day.start.getTime()).toBe(12*3600000);
    const overnight = calculateCrewWindow(input('19:00','07:00')); expect(overnight.end.getTime()-overnight.start.getTime()).toBe(12*3600000);
    expect(day.start.toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });
  it('rejects invalid dates, times and timezones', () => {
    expect(() => calculateCrewWindow(input('07:00','19:00','Mars/Nope'))).toThrow();
    expect(() => calculateCrewWindow(input('07:00','19:00','UTC','2026-02-31'))).toThrow();
    expect(() => calculateCrewWindow(input('25:00','19:00'))).toThrow();
  });
  it('rejects nonexistent and ambiguous daylight-saving local times', () => {
    expect(() => calculateCrewWindow(input('02:30','04:00','America/New_York','2026-03-08'))).toThrow('nonexistent_local_time');
    expect(() => calculateCrewWindow(input('01:30','03:00','America/New_York','2026-11-01'))).toThrow('ambiguous_local_time');
  });
});
