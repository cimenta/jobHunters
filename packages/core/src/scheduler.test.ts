import { describe, expect, it } from 'vitest';
import { InMemoryKeyValueStore } from './key-value';
import { Scheduler, type ScheduledTask } from './scheduler';

function setup(tasks: Partial<ScheduledTask>[]) {
  const runs: string[] = [];
  const logs: string[] = [];
  const lastRun = new InMemoryKeyValueStore();
  const full: ScheduledTask[] = tasks.map((task, index) => ({
    id: `t${index + 1}`, enabled: () => true, hours: () => [8, 18], run: () => void runs.push(`t${index + 1}`), ...task,
  }));
  const scheduler = new Scheduler({ tasks: full, lastRun, log: (flow, entity, message) => logs.push(`${flow}|${entity}|${message}`) });
  return { scheduler, runs, logs, lastRun };
}

const at = (hour: number, day = '2026-10-12') => ({ day, hour });

describe('Scheduler', () => {
  it('runs a task in its hours only', () => {
    const { scheduler, runs } = setup([{}]);
    expect(scheduler.tick(at(7))).toEqual([]);
    expect(scheduler.tick(at(8))).toEqual(['t1']);
    expect(scheduler.tick(at(9))).toEqual([]);
    expect(scheduler.tick(at(18))).toEqual(['t1']);
    expect(runs).toEqual(['t1', 't1']);
  });

  it('runs a task once in an hour although the trigger fires again, and again the next day', () => {
    const { scheduler, runs } = setup([{}]);
    scheduler.tick(at(8));
    scheduler.tick(at(8));
    expect(runs).toHaveLength(1);
    scheduler.tick(at(8, '2026-10-13'));
    expect(runs).toHaveLength(2);
  });

  it('skips a disabled task', () => {
    const { scheduler, runs } = setup([{ enabled: () => false }]);
    expect(scheduler.tick(at(8))).toEqual([]);
    expect(runs).toEqual([]);
  });

  it('keeps going when one task fails and logs the failure', () => {
    const { scheduler, runs, logs } = setup([{ run: () => { throw new Error('boom'); } }, {}]);
    expect(scheduler.tick(at(8))).toEqual(['t1', 't2']);
    expect(runs).toEqual(['t2']);
    expect(logs).toEqual(['schedule|t1|boom']);
  });

  it('keeps the last run of every task apart', () => {
    const { scheduler, runs } = setup([{ hours: () => [8] }, { hours: () => [8, 9] }]);
    scheduler.tick(at(8));
    scheduler.tick(at(9));
    expect(runs).toEqual(['t1', 't2', 't2']);
  });
});
