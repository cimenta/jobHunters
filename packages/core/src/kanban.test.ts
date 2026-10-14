import { describe, expect, it } from 'vitest';
import { ApplicationService } from './application-service';
import { sortBoard } from './board';
import { InMemoryAppendLog, InMemoryRepository } from './repository';
import { JOB_SORTS, parseUiState } from './ui-state';
import { DEFAULT_TRANSITIONS, canTransition, parseStatusTransitions, serializeStatusTransitions } from './status';
import { parseSettings } from './settings';
import { errorOf } from './testing/errors';
import { makeApplication, sequentialIds } from './testing/fixtures';
import type { Application, Reminder, StatusHistoryEntry } from './types';

const NOW = '2026-10-12T08:00:00.000Z';

function setup(applications: Application[], transitions?: Parameters<typeof canTransition>[2]) {
  const repo = new InMemoryRepository<Application>(applications);
  const reminders = new InMemoryRepository<Reminder>();
  const service = new ApplicationService({
    applications: repo, reminders, history: new InMemoryAppendLog<StatusHistoryEntry>(), newId: sequentialIds('r'), now: () => NOW,
    locale: () => 'en', ...(transitions ? { transitions: () => transitions } : {}),
  });
  return { service, repo, reminders };
}

const card = (id: string, status: string, board_position: number | null = null, last_activity_at = '2026-10-01T00:00:00.000Z') =>
  makeApplication({ id, status, board_position, last_activity_at });

describe('status transitions setting', () => {
  it('defaults to the built-in rules and keeps the default of an unmentioned status', () => {
    expect(parseStatusTransitions('{}')).toEqual(DEFAULT_TRANSITIONS);
    const custom = parseStatusTransitions('{"draft":["offer"]}')!;
    expect(custom.draft).toEqual(['offer']);
    expect(custom.sent).toEqual(DEFAULT_TRANSITIONS.sent);
    expect(parseStatusTransitions(serializeStatusTransitions(custom))).toEqual(custom);
  });

  it('refuses an unknown status, a move to itself and a wrong shape', () => {
    for (const raw of ['x', '[]', '{"nope":[]}', '{"draft":["nope"]}', '{"draft":["draft"]}', '{"draft":"sent"}']) {
      expect(parseStatusTransitions(raw), raw).toBeUndefined();
    }
  });

  it('is part of the settings, with the default when invalid', () => {
    expect(parseSettings({}).settings.status_transitions).toEqual(DEFAULT_TRANSITIONS);
    const { settings, warnings } = parseSettings({ status_transitions: '{"draft":["bogus"]}' });
    expect(settings.status_transitions).toEqual(DEFAULT_TRANSITIONS);
    expect(warnings).toHaveLength(1);
  });

  it('is used by setStatus: the user can allow and forbid moves', () => {
    const open = parseStatusTransitions('{"draft":["offer"],"rejected":["sent"]}')!;
    const { service } = setup([card('a1', 'draft'), card('a2', 'rejected')], open);
    expect(service.setStatus('a1', 'offer').status).toBe('offer');
    expect(service.setStatus('a2', 'sent').status).toBe('sent');
    const closed = parseStatusTransitions('{"draft":[]}')!;
    expect(errorOf(() => setup([card('a1', 'draft')], closed).service.setStatus('a1', 'sent'))).toMatchObject({ code: 'transition_not_allowed' });
  });
});

describe('board order', () => {
  it('puts unplaced cards first, the most recent first, then the placed ones by position', () => {
    const cards = [card('p2', 'sent', 2), card('n1', 'sent', null, '2026-10-02T00:00:00.000Z'), card('p1', 'sent', 1), card('n2', 'sent', null, '2026-10-05T00:00:00.000Z')];
    expect(sortBoard(cards).map((c) => c.id)).toEqual(['n2', 'n1', 'p1', 'p2']);
  });
});

describe('ApplicationService.move', () => {
  const sent = () => [card('a', 'sent', 1), card('b', 'sent', 2), card('c', 'sent', 3), card('d', 'draft', null)];

  it('reorders inside a column and stores the new positions', () => {
    const { service, repo } = setup(sent());
    service.move('c', 'sent', 0);
    expect(sortBoard(repo.list().filter((a) => a.status === 'sent')).map((a) => [a.id, a.board_position])).toEqual([['c', 1], ['a', 2], ['b', 3]]);
    service.move('c', 'sent', 99);
    expect(sortBoard(repo.list().filter((a) => a.status === 'sent')).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('changes the status when the column differs and places the card there', () => {
    const { service, repo } = setup(sent());
    service.move('d', 'sent', 1);
    expect(sortBoard(repo.list().filter((a) => a.status === 'sent')).map((a) => a.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(repo.get('d')).toMatchObject({ status: 'sent', board_position: 2 });
  });

  it('refuses a move the rules forbid and leaves the order alone', () => {
    const { service, repo } = setup([...sent(), card('r', 'rejected')]);
    expect(errorOf(() => service.move('r', 'sent', 0))).toMatchObject({ code: 'transition_not_allowed' });
    expect(repo.get('a')?.board_position).toBe(1);
    expect(repo.get('r')?.status).toBe('rejected');
  });

  it('needs a date for waiting and creates the reminder', () => {
    const { service, reminders } = setup(sent());
    expect(errorOf(() => service.move('a', 'waiting', 0))).toMatchObject({ code: 'reminder_date_required' });
    expect(service.move('a', 'waiting', 0, { remindAt: '2026-10-20' }).status).toBe('waiting');
    expect(reminders.list()).toHaveLength(1);
  });

  it('puts a card moved by a plain status change at the top of its new column', () => {
    const { service, repo } = setup([card('a', 'sent', 1), card('b', 'draft', 4)]);
    service.setStatus('b', 'sent');
    expect(repo.get('b')?.board_position).toBeNull();
    expect(sortBoard(repo.list().filter((a) => a.status === 'sent')).map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('refuses an unknown application', () => {
    expect(errorOf(() => setup([]).service.move('zz', 'sent', 0))).toMatchObject({ code: 'application_not_found' });
  });
});

describe('ui state setting', () => {
  it('defaults, parses and drops unknown statuses', () => {
    expect(parseUiState('{}')).toEqual({ applications_kanban: false, applications_hide_empty: false, applications_status_list: [], applications_status_board: [], jobs_hide_applied: false, jobs_sort: 'newest', applications_board_sort: {}, applications_list_sort: { by: 'default', up: false } });
    expect(parseUiState('{"applications_hide_empty":true}')?.applications_hide_empty).toBe(true);
    expect(parseUiState('{"applications_hide_empty":"yes"}')).toBeUndefined();
    expect(parseUiState('{"applications_kanban":true,"applications_status_board":["sent","nope","sent"]}'))
      .toEqual({ applications_kanban: true, applications_hide_empty: false, applications_status_list: [], applications_status_board: ['sent'], jobs_hide_applied: false, jobs_sort: 'newest', applications_board_sort: {}, applications_list_sort: { by: 'default', up: false } });
  });

  it('parses the sort choices of the board and the list, dropping what does not fit', () => {
    const parsed = parseUiState('{"applications_board_sort":{"draft":{"by":"match","up":true},"waiting":{"by":"waiting","up":false},"nope":{"by":"match","up":false},"sent":{"by":"waiting","up":false}},"applications_list_sort":{"by":"salary","up":true}}');
    expect(parsed?.applications_board_sort).toEqual({ draft: { by: 'match', up: true }, waiting: { by: 'waiting', up: false } });
    expect(parsed?.applications_list_sort).toEqual({ by: 'salary', up: true });
  });
  it('falls back to the defaults for sort choices of a wrong shape', () => {
    expect(parseUiState('{"applications_board_sort":[]}')).toBeUndefined();
    expect(parseUiState('{"applications_board_sort":{"draft":"match"}}')).toBeUndefined();
    expect(parseUiState('{"applications_board_sort":{"draft":{"by":"match","up":"yes"}}}')).toBeUndefined();
    expect(parseUiState('{"applications_list_sort":{"by":"manual","up":false}}')).toBeUndefined();
    expect(parseUiState('{"applications_list_sort":{"by":"match"}}')).toBeUndefined();
    expect(parseUiState('{"applications_list_sort":5}')).toBeUndefined();
  });

  it('parses the Jobs screen choices and keeps defaults for a 0.12.2 value', () => {
    const parsed = parseUiState('{"jobs_sort":"match_desc","jobs_hide_applied":true}');
    expect(parsed?.jobs_sort).toBe('match_desc');
    expect(parsed?.jobs_hide_applied).toBe(true);
    expect(parseUiState('{"jobs_sort":"nope"}')).toBeUndefined();
    expect(parseUiState('{"jobs_sort":1}')).toBeUndefined();
    expect(parseUiState('{"jobs_hide_applied":"yes"}')).toBeUndefined();
    expect(parseUiState('{"applications_kanban":true,"applications_hide_empty":true,"applications_status_list":[],"applications_status_board":[]}'))
      .toMatchObject({ jobs_hide_applied: false, jobs_sort: 'newest' });
    expect(JOB_SORTS).toEqual(['newest', 'oldest', 'match_desc', 'match_asc']);
  });

  it('refuses a wrong shape', () => {
    for (const raw of ['x', '[]', '{"applications_kanban":"yes"}', '{"applications_status_list":"sent"}', '{"applications_status_list":[1]}']) {
      expect(parseUiState(raw), raw).toBeUndefined();
    }
  });
});
