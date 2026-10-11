import { describe, expect, it } from 'vitest';
import { describeEvent } from './timeline';

describe('describeEvent', () => {
  it('describes each kind of event in plain language', () => {
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: '', to: 'draft' } })).toBe('Application created');
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: 'draft', to: 'sent' } })).toBe('Status: Draft → Sent');
    expect(describeEvent({ at: 'x', type: 'communication', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: 'They replied' } })).toBe('Incoming · E-mail: They replied');
    expect(describeEvent({ at: 'x', type: 'document', ref: 'd', data: { type: 'resume' } })).toBe('Document created: Resume');
    expect(describeEvent({ at: 'x', type: 'pdf', ref: 'd', data: { type: 'cover_letter' } })).toBe('PDF exported: Cover letter');
    expect(describeEvent({ at: 'x', type: 'reminder', ref: 'r', data: { state: 'created', text: 'Call HR' } })).toBe('Reminder added: Call HR');
    expect(describeEvent({ at: 'x', type: 'reminder', ref: 'r', data: { state: 'done', text: 'Call HR' } })).toBe('Reminder completed: Call HR');
  });
  it('does not fail on values it does not know', () => {
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: 'weird', to: 'sent' } })).toBe('Status: weird → Sent');
    expect(describeEvent({ at: 'x', type: 'communication', ref: 'm', data: { direction: 'odd', channel: 'odd', summary: 'S' } })).toContain('S');
  });
});
