import type { TimelineEvent } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import { channelIcon, directionArrow, eventIcon, isUpcoming, kindIcon, typeIcon } from './entry-style';

const event = (type: TimelineEvent['type'], at = '2026-10-01T10:00:00.000Z', data: Record<string, string> = {}): TimelineEvent => ({ at, type, ref: 'x', data });

describe('entry-style', () => {
  it('picks an icon per channel and per type', () => {
    expect(channelIcon('email')).toBe('mail');
    expect(channelIcon('phone')).toBe('phone');
    expect(channelIcon('video')).toBe('video');
    expect(channelIcon('portal')).toBe('chat');
    expect(channelIcon('weird')).toBe('chat');
    expect(typeIcon('status')).toBe('flag');
    expect(typeIcon('meeting')).toBe('calendar');
    expect(typeIcon('homework')).toBe('task');
    expect(typeIcon('confirmation')).toBe('check');
    expect(typeIcon('document')).toBe('file');
    expect(typeIcon('pdf')).toBe('download');
    expect(typeIcon('reminder')).toBe('bell');
  });

  it('shows the channel icon for messages and the type icon for the other kinds', () => {
    expect(eventIcon(event('message', undefined, { channel: 'phone' }))).toBe('phone');
    expect(eventIcon(event('meeting', undefined, { channel: 'phone' }))).toBe('calendar');
    expect(kindIcon('message', 'email')).toBe('mail');
    expect(kindIcon('homework', 'email')).toBe('task');
    expect(kindIcon('mesage', 'email')).toBe('mail');
  });

  it('draws a direction arrow only for communication kinds with a direction', () => {
    expect(directionArrow('incoming', 'homework')).toBe('arrow-in');
    expect(directionArrow('outgoing', 'message')).toBe('arrow-out');
    expect(directionArrow('note', 'message')).toBeUndefined();
    expect(directionArrow('incoming', 'status')).toBeUndefined();
  });

  it('marks only meetings in the future as upcoming and never throws on bad times', () => {
    const now = Date.parse('2026-10-13T12:00:00.000Z');
    expect(isUpcoming(event('meeting', '2026-10-20T14:00:00.000Z'), now)).toBe(true);
    expect(isUpcoming(event('meeting', '2026-10-10T14:00:00.000Z'), now)).toBe(false);
    expect(isUpcoming(event('message', '2099-01-01T00:00:00.000Z'), now)).toBe(false);
    expect(isUpcoming(event('meeting', '2026-10-20'), now)).toBe(true);
    expect(isUpcoming(event('meeting', 'not a date'), now)).toBe(false);
    expect(isUpcoming(event('meeting', ''), now)).toBe(false);
  });
});
