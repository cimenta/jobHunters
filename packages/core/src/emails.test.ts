import { describe, expect, it } from 'vitest';
import { emailRow, emailRows, emailSearchText, firstAddressLabel } from './emails';
import type { Email } from './types';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 'm1', thread_id: 't1', received_at: '2026-10-16T09:30:00.000Z', direction: 'incoming', from_email: 'jana@example.com', from_name: 'Jana Nováková',
  to: 'you@example.invalid', cc: '', subject: 'Senior Android Developer', body: 'Hello,\n\n  I am   contacting you.', attachments: 'job.pdf | cv.docx', is_bulk: false,
  type: '', type_confidence: '', signals: '', application_id: '', job_id: '', match_method: '', state: '', communication_id: '', ...overrides,
});

describe('firstAddressLabel', () => {
  it.each([
    ['Jana <jana@example.com>, bob@example.com', 'Jana'],
    ['"Novak, Jan" <jan@example.com>, x@example.com', 'Novak, Jan'],
    ['<only@example.com>', 'only@example.com'],
    ['bob@example.com, jana@example.com', 'bob@example.com'],
    ['', ''],
  ])('reads %j as %j', (header, label) => {
    expect(firstAddressLabel(header)).toBe(label);
  });
});

describe('emailRow', () => {
  it('leaves the body out, keeps a one-line excerpt and splits the attachments', () => {
    const row = emailRow(email());
    expect(row).not.toHaveProperty('body');
    expect(row).toMatchObject({ counterpart: 'Jana Nováková', excerpt: 'Hello, I am contacting you.', attachment_list: ['job.pdf', 'cv.docx'] });
  });

  it('names the sender of an incoming mail by the address when it has no name, and the first recipient of an outgoing one', () => {
    expect(emailRow(email({ from_name: '' })).counterpart).toBe('jana@example.com');
    expect(emailRow(email({ direction: 'outgoing', to: 'Petr Svoboda <petr@example.com>, x@example.com' })).counterpart).toBe('Petr Svoboda');
  });

  it('caps the excerpt and has no attachments for an empty cell', () => {
    const row = emailRow(email({ body: 'x'.repeat(1000), attachments: '' }));
    expect(row.excerpt).toHaveLength(300);
    expect(row.attachment_list).toEqual([]);
  });
});

describe('emailRows', () => {
  it('puts the newest first and a row without a readable date last', () => {
    const rows = emailRows([email({ id: 'a', received_at: '2026-10-01T08:00:00.000Z' }), email({ id: 'b', received_at: 'nonsense' }), email({ id: 'c', received_at: '2026-10-16T08:00:00.000Z' })]);
    expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('emailSearchText', () => {
  it('finds a word without regard to case or diacritics in the sender, the subject, the attachments and the excerpt', () => {
    const text = emailSearchText(emailRow(email()));
    for (const word of ['novakova', 'android', 'cv.docx', 'contacting']) expect(text).toContain(word);
  });
});
