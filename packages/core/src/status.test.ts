import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES, canTransition, isApplicationStatus, type ApplicationStatus } from './status';

describe('isApplicationStatus', () => {
  it('accepts every defined status', () => {
    for (const status of APPLICATION_STATUSES) expect(isApplicationStatus(status)).toBe(true);
  });

  it.each(['Waiting', 'waiting ', '', 'done', 'SENT'])('rejects "%s"', (value) => {
    expect(isApplicationStatus(value)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isApplicationStatus(undefined)).toBe(false);
    expect(isApplicationStatus(3)).toBe(false);
  });
});

describe('canTransition', () => {
  it('lists the statuses from the spec', () => {
    expect([...APPLICATION_STATUSES]).toEqual([
      'draft', 'sent', 'waiting', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn',
    ]);
  });

  it.each(APPLICATION_STATUSES)('%s never goes back to draft and never to itself', (status) => {
    expect(canTransition(status, 'draft')).toBe(false);
    expect(canTransition(status, status)).toBe(false);
  });

  it('allows the normal forward flow', () => {
    expect(canTransition('draft', 'sent')).toBe(true);
    expect(canTransition('sent', 'waiting')).toBe(true);
    expect(canTransition('waiting', 'interview')).toBe(true);
    expect(canTransition('interview', 'offer')).toBe(true);
  });

  it('allows waiting from every active status', () => {
    const active: ApplicationStatus[] = ['draft', 'sent', 'interview', 'offer', 'ghosted'];
    for (const status of active) expect(canTransition(status, 'waiting')).toBe(true);
  });

  it('allows every active status to end as rejected or withdrawn', () => {
    const active: ApplicationStatus[] = ['sent', 'waiting', 'interview', 'offer', 'ghosted'];
    for (const status of active) {
      expect(canTransition(status, 'rejected')).toBe(true);
      expect(canTransition(status, 'withdrawn')).toBe(true);
    }
  });

  it('lets a ghosted application come back when they reply late', () => {
    expect(canTransition('ghosted', 'interview')).toBe(true);
  });

  it('treats rejected and withdrawn as final', () => {
    for (const to of APPLICATION_STATUSES) {
      expect(canTransition('rejected', to)).toBe(false);
      expect(canTransition('withdrawn', to)).toBe(false);
    }
  });
});
