import { describe, expect, it } from 'vitest';
import { describeEvent, eventHoverText, eventSubline } from './timeline';

describe('describeEvent', () => {
  it('describes each kind of event in plain language', () => {
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: '', to: 'draft' } })).toBe('Application created');
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: 'draft', to: 'sent' } })).toBe('Status: Draft → Sent');
    expect(describeEvent({ at: 'x', type: 'message', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: 'They replied' } })).toBe('Incoming · E-mail: They replied');
    expect(describeEvent({ at: 'x', type: 'document', ref: 'd', data: { type: 'resume' } })).toBe('Document created: Resume');
    expect(describeEvent({ at: 'x', type: 'pdf', ref: 'd', data: { type: 'cover_letter' } })).toBe('PDF exported: Cover letter');
    expect(describeEvent({ at: 'x', type: 'reminder', ref: 'r', data: { state: 'created', text: 'Call HR' } })).toBe('Reminder added: Call HR');
    expect(describeEvent({ at: 'x', type: 'reminder', ref: 'r', data: { state: 'done', text: 'Call HR' } })).toBe('Reminder completed: Call HR');
  });
  it('describes meetings, homework and confirmations', () => {
    expect(describeEvent({ at: 'x', type: 'meeting', ref: 'm', data: { direction: 'incoming', channel: 'video', summary: 'Technical interview' } })).toBe('Meeting: Technical interview');
    expect(describeEvent({ at: 'x', type: 'homework', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: 'Take-home task' } })).toBe('Homework received: Take-home task');
    expect(describeEvent({ at: 'x', type: 'homework', ref: 'm', data: { direction: 'outgoing', channel: 'portal', summary: 'Repo link' } })).toBe('Homework submitted: Repo link');
    expect(describeEvent({ at: 'x', type: 'confirmation', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: 'Auto reply' } })).toBe('Application receipt confirmed: Auto reply');
  });
  it('gives a second line with the channel for the new kinds and none for the others', () => {
    expect(eventSubline({ at: 'x', type: 'meeting', ref: 'm', data: { direction: 'incoming', channel: 'video', summary: 'S' } })).toBe('Video call · Invited by the employer');
    expect(eventSubline({ at: 'x', type: 'homework', ref: 'm', data: { direction: 'outgoing', channel: 'portal', summary: 'S' } })).toBe('Portal');
    expect(eventSubline({ at: 'x', type: 'message', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: 'S' } })).toBe('');
    expect(eventSubline({ at: 'x', type: 'status', ref: 'a', data: { from: '', to: 'draft' } })).toBe('');
  });
  it('describes an entry after a meeting', () => {
    expect(describeEvent({ at: 'x', type: 'after_meeting', ref: 'm', data: { direction: 'note', channel: '', summary: 'It went well' } })).toBe('After the meeting: It went well');
    expect(describeEvent({ at: 'x', type: 'after_meeting', ref: 'm', data: { direction: 'note', channel: '', summary: '' } })).toBe('After the meeting');
    expect(eventHoverText({ at: 'x', type: 'after_meeting', ref: 'm', data: { summary: 'S', details: 'D' } })).toEqual({ summary: 'S', details: 'D' });
  });
  it('describes an entry that has no summary without a dangling colon', () => {
    expect(describeEvent({ at: 'x', type: 'message', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: '' } })).toBe('Incoming · E-mail');
    expect(describeEvent({ at: 'x', type: 'meeting', ref: 'm', data: { direction: 'incoming', channel: 'video', summary: '' } })).toBe('Meeting');
    expect(describeEvent({ at: 'x', type: 'homework', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: '' } })).toBe('Homework received');
    expect(describeEvent({ at: 'x', type: 'homework', ref: 'm', data: { direction: 'outgoing', channel: 'email', summary: '' } })).toBe('Homework submitted');
    expect(describeEvent({ at: 'x', type: 'confirmation', ref: 'm', data: { direction: 'incoming', channel: 'email', summary: '' } })).toBe('Application receipt confirmed');
  });
  it('gives hover text only for communication entries that have a summary or details', () => {
    expect(eventHoverText({ at: 'x', type: 'message', ref: 'm', data: { summary: 'S', details: 'D' } })).toEqual({ summary: 'S', details: 'D' });
    expect(eventHoverText({ at: 'x', type: 'meeting', ref: 'm', data: { summary: 'S' } })).toEqual({ summary: 'S', details: '' });
    expect(eventHoverText({ at: 'x', type: 'message', ref: 'm', data: { summary: '', details: '' } })).toBeUndefined();
    expect(eventHoverText({ at: 'x', type: 'status', ref: 'a', data: { from: 'a', to: 'b' } })).toBeUndefined();
    expect(eventHoverText({ at: 'x', type: 'document', ref: 'd', data: { type: 'resume' } })).toBeUndefined();
  });
  it('does not fail on values it does not know', () => {
    expect(describeEvent({ at: 'x', type: 'status', ref: 'a', data: { from: 'weird', to: 'sent' } })).toBe('Status: weird → Sent');
    expect(describeEvent({ at: 'x', type: 'message', ref: 'm', data: { direction: 'odd', channel: 'odd', summary: 'S' } })).toContain('S');
  });
});
