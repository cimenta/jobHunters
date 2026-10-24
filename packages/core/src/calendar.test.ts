import { describe, expect, it } from 'vitest';
import { buildCalendar } from './calendar';
import { makeApplication, makeCompany, makeJob, makeReminder } from './testing/fixtures';
import type { Communication, StatusHistoryEntry } from './types';

const communication = (over: Partial<Communication>): Communication => ({
  id: 'm', application_id: '', datetime: '2026-10-15T10:00:00.000Z', direction: 'incoming', channel: 'video', contact_id: '', summary: '', details: '', attachment_url: '', kind: 'meeting', job_id: '', ...over,
});
const move = (application_id: string, from: string, to: string, at: string): StatusHistoryEntry => ({ application_id, from, to, at });

const companies = [makeCompany({ id: 'c1', name: 'Example s.r.o.' })];
const jobs = [makeJob({ id: 'j1', company_id: 'c1', title: 'Analyst' }), makeJob({ id: 'j2', company_id: 'c1', title: 'Gig' })];
const applications = [makeApplication({ id: 'a1', job_id: 'j1', status: 'waiting' }), makeApplication({ id: 'a2', job_id: 'j1', status: 'sent' })];
const base = { communications: [], applications, jobs, companies, reminders: [], history: [] };

describe('buildCalendar interviews', () => {
  it('takes only meetings, oldest first, with the company and the job', () => {
    const { interviews } = buildCalendar({
      ...base,
      communications: [
        communication({ id: 'late', application_id: 'a1', datetime: '2026-10-20T09:00:00.000Z' }),
        communication({ id: 'note', application_id: 'a1', kind: 'message' }),
        communication({ id: 'old', application_id: 'a2', datetime: '2026-10-02T09:00:00.000Z' }),
        communication({ id: 'blank', application_id: 'a1', kind: '' }),
        communication({ id: 'nodate', application_id: 'a1', datetime: '' }),
      ],
    });
    expect(interviews.map((i) => i.id)).toEqual(['old', 'late']);
    expect(interviews[0]).toMatchObject({ application_id: 'a2', job_id: 'j1', company_name: 'Example s.r.o.', job_title: 'Analyst', channel: 'video' });
  });
  it('keeps a meeting of a job that has no application', () => {
    const { interviews } = buildCalendar({ ...base, communications: [communication({ id: 'g', job_id: 'j2' })] });
    expect(interviews[0]).toMatchObject({ application_id: '', job_id: 'j2', job_title: 'Gig' });
  });
});

describe('buildCalendar homeworks', () => {
  it('lists the applications in homework with the deadline of the open homework reminder, soonest first', () => {
    const apps = [makeApplication({ id: 'h1', job_id: 'j1', status: 'homework' }), makeApplication({ id: 'h2', job_id: 'j2', status: 'homework' }), makeApplication({ id: 'h3', job_id: 'j1', status: 'interview' })];
    const { homeworks } = buildCalendar({
      ...base,
      applications: apps,
      reminders: [
        makeReminder({ id: 'r1', application_id: 'h1', source: 'homework', status: 'open', due_at: '2026-10-30' }),
        makeReminder({ id: 'r2', application_id: 'h2', source: 'homework', status: 'open', due_at: '2026-10-28' }),
        makeReminder({ id: 'r3', application_id: 'h3', source: 'homework', status: 'open', due_at: '2026-10-29' }),
        makeReminder({ id: 'r4', application_id: 'h1', source: 'homework', status: 'done', due_at: '2026-10-01' }),
      ],
    });
    expect(homeworks.map((h) => [h.application_id, h.due_at, h.job_title])).toEqual([['h2', '2026-10-28', 'Gig'], ['h1', '2026-10-30', 'Analyst']]);
  });
  it('skips a homework application without an open deadline', () => {
    const { homeworks } = buildCalendar({ ...base, applications: [makeApplication({ id: 'h1', job_id: 'j1', status: 'homework' })] });
    expect(homeworks).toEqual([]);
  });
});

describe('buildCalendar waitings', () => {
  it('lists the applications in waiting with the start of the waiting and the due date of the open reminder', () => {
    const { waitings } = buildCalendar({
      ...base,
      history: [
        move('a1', '', 'draft', '2026-10-01T08:00:00.000Z'),
        move('a1', 'sent', 'waiting', '2026-10-06T08:00:00.000Z'),
        move('a1', 'waiting', 'waiting', '2026-10-10T08:00:00.000Z'),
      ],
      reminders: [
        makeReminder({ id: 'r1', application_id: 'a1', source: 'waiting', status: 'open', due_at: '2026-10-20' }),
        makeReminder({ id: 'r2', application_id: 'a1', source: 'waiting', status: 'done', due_at: '2026-10-09' }),
        makeReminder({ id: 'r3', application_id: 'a1', source: 'manual', status: 'open', due_at: '2026-10-25' }),
      ],
    });
    expect(waitings).toEqual([
      { application_id: 'a1', job_id: 'j1', start: '2026-10-06T08:00:00.000Z', due_at: '2026-10-20', company_name: 'Example s.r.o.', job_title: 'Analyst' },
    ]);
  });
  it('leaves start and due date empty when nothing says them, and skips other statuses', () => {
    const { waitings } = buildCalendar(base);
    expect(waitings.map((w) => [w.application_id, w.start, w.due_at])).toEqual([['a1', '', '']]);
  });
});
