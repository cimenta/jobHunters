import { communicationKind, type TimelineEvent, type TimelineType } from '@jobhunters/core';
import type { IconName } from '../components/Icon.svelte';

export function channelIcon(channel: string): IconName {
  switch (channel) {
    case 'email':
      return 'mail';
    case 'phone':
      return 'phone';
    case 'video':
      return 'video';
    default:
      return 'chat';
  }
}

export function typeIcon(type: TimelineType): IconName {
  switch (type) {
    case 'status':
      return 'flag';
    case 'message':
      return 'mail';
    case 'meeting':
      return 'calendar';
    case 'homework':
      return 'task';
    case 'confirmation':
      return 'check';
    case 'document':
      return 'file';
    case 'pdf':
      return 'download';
    case 'reminder':
      return 'bell';
  }
}

/** A message shows the icon of its channel, everything else the icon of its type. */
export function eventIcon(event: TimelineEvent): IconName {
  return event.type === 'message' ? channelIcon(event.data.channel ?? '') : typeIcon(event.type);
}

/** The same rule for an entry of the Communication tab, whose kind may be empty or unknown (read as a message). */
export function kindIcon(kind: string, channel: string): IconName {
  const known = communicationKind(kind);
  return known === 'message' ? channelIcon(channel) : typeIcon(known);
}

const WITH_DIRECTION: readonly TimelineType[] = ['message', 'meeting', 'homework', 'confirmation'];

export function directionArrow(direction: string, type: TimelineType): IconName | undefined {
  if (!WITH_DIRECTION.includes(type)) return undefined;
  return direction === 'incoming' ? 'arrow-in' : direction === 'outgoing' ? 'arrow-out' : undefined;
}

/** A meeting that starts after `now` (milliseconds). A time that cannot be read is never upcoming. */
export function isUpcoming(event: TimelineEvent, now: number): boolean {
  if (event.type !== 'meeting') return false;
  const start = Date.parse(event.at);
  return !Number.isNaN(start) && start > now;
}
