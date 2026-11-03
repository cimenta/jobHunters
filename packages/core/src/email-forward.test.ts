import { describe, expect, it } from 'vitest';
import { unwrapForwarded } from './email-forward';

// Invented data only.

/** Prague: +1 hour in winter, +2 in summer (the clock change of 2026 falls on 25 October). */
const prague = (instant: number): number => (instant >= Date.UTC(2026, 2, 29, 1) && instant < Date.UTC(2026, 9, 25, 1) ? 120 : 60);

const outer = { from_email: 'me.other@example.invalid', to: 'me@example.invalid', cc: '', received_at: '2026-11-03T07:15:29.000Z', direction: 'incoming' };

describe('unwrapForwarded', () => {
  it('takes the sender, date, subject and text from a Czech webmail forward, reading the date in the script zone', () => {
    const body = '\n\n---------- Původní e‑mail ----------\nOd: Jana Nováková <jana@acme.example>\nKomu: me.other@example.invalid <me.other@example.invalid>\nDatum: 3. 11. 2026 2:56:39\nPředmět: Pozice AI konzultant\n" \nDobrý den,\n\nzkoušela jsem volat.\n\nDěkuji, Jana\n"';
    const result = unwrapForwarded({ ...outer, subject: 'Fwd: Pozice AI konzultant', body }, prague);
    expect(result).toEqual({
      from_email: 'jana@acme.example',
      from_name: 'Jana Nováková',
      to: 'me.other@example.invalid <me.other@example.invalid>',
      cc: '',
      received_at: '2026-11-03T01:56:39.000Z',
      subject: 'Pozice AI konzultant',
      body: 'Dobrý den,\n\nzkoušela jsem volat.\n\nDěkuji, Jana',
      direction: 'incoming',
    });
  });

  it('reads a Gmail forward in English with a 12-hour clock', () => {
    const body = 'FYI\n\n---------- Forwarded message ---------\nFrom: Sam Recruiter <sam@globex.example>\nDate: Mon, Nov 2, 2026 at 3:05 PM\nSubject: Interview\nTo: Alex <me.other@example.invalid>\n\nHello Alex,\nsee you soon.';
    const result = unwrapForwarded({ ...outer, subject: 'Fwd: Interview', body }, prague);
    expect(result).toMatchObject({ from_email: 'sam@globex.example', from_name: 'Sam Recruiter', received_at: '2026-11-02T14:05:00.000Z', subject: 'Interview', body: 'Hello Alex,\nsee you soon.' });
  });

  it('honours an explicit offset and the winter and summer offsets of the zone', () => {
    const forward = (date: string) => unwrapForwarded({ ...outer, subject: 'FW: x', body: `-----Original Message-----\nFrom: a@b.example\nSent: ${date}\nSubject: x\n\ntext` }, prague)?.received_at;
    expect(forward('Mon, 2 Nov 2026 15:00:00 +0100')).toBe('2026-11-02T14:00:00.000Z');
    expect(forward('Mon, 2 Nov 2026 15:00:00 -0500')).toBe('2026-11-02T20:00:00.000Z');
    expect(forward('Mon, 2 Nov 2026 15:00:00')).toBe('2026-11-02T14:00:00.000Z');
    expect(forward('Wed, 15 Jul 2026 15:00:00')).toBe('2026-07-15T13:00:00.000Z');
    expect(forward('po 2. 11. 2026 v 15:00')).toBe('2026-11-02T14:00:00.000Z');
  });

  it('reads an Outlook forward with Czech header names and a bracketed address', () => {
    const body = '________________________________\nOd: "Eva Test" [eva@initech.example]\nOdesláno: pondělí 2. listopadu 2026 15:00\nKomu: me.other@example.invalid\nKopie: boss@initech.example\nPředmět: Nabídka\n\nDobrý den.';
    const result = unwrapForwarded({ ...outer, subject: 'FW: Nabídka', body });
    expect(result).toMatchObject({ from_email: 'eva@initech.example', from_name: 'Eva Test', cc: 'boss@initech.example', received_at: '2026-11-02T15:00:00.000Z', subject: 'Nabídka', body: 'Dobrý den.' });
  });

  it('keeps the arrival date and the subject without the prefix when the header has none', () => {
    const result = unwrapForwarded({ ...outer, subject: 'Fwd: Hello', body: '---------- Forwarded message ---------\nFrom: a@b.example\n\ntext' });
    expect(result).toMatchObject({ from_email: 'a@b.example', from_name: '', received_at: outer.received_at, subject: 'Hello', body: 'text' });
  });

  it('keeps a copy of the user\'s own mail outgoing', () => {
    const result = unwrapForwarded({ ...outer, direction: 'outgoing', subject: 'Fwd: Hello', body: '---------- Forwarded message ---------\nFrom: Me <me.other@example.invalid>\nTo: a@b.example\n\ntext' });
    expect(result?.direction).toBe('outgoing');
  });

  it('leaves alone a mail that is not a forwarded copy', () => {
    const quoted = '---------- Forwarded message ---------\nFrom: a@b.example\nDate: 2. 11. 2026 10:00\n\ntext';
    expect(unwrapForwarded({ ...outer, subject: 'Your application', body: quoted })).toBeUndefined();
    expect(unwrapForwarded({ ...outer, subject: 'Fwd: Hello', body: 'No header here, only text.' })).toBeUndefined();
    expect(unwrapForwarded({ ...outer, subject: 'Fwd: Hello', body: `${'long note '.repeat(60)}\n${quoted}` })).toBeUndefined();
    expect(unwrapForwarded({ ...outer, subject: 'Fwd: Hello', body: '---------- Forwarded message ---------\nSubject: no sender\n\ntext' })).toBeUndefined();
  });
});
