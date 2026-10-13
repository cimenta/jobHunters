import type { TimelineEvent } from '@jobhunters/core';
import { tr } from './i18n.svelte';
import { channelLabel, directionLabel, directionLabelFor, documentTypeLabel } from './labels';
import { statusStyle } from './status';

export function describeEvent(event: TimelineEvent): string {
  const { data } = event;
  switch (event.type) {
    case 'status':
      return data.from === ''
        ? tr('ui.timeline.created')
        : tr('ui.timeline.status', { from: statusStyle(data.from ?? '').text, to: statusStyle(data.to ?? '').text });
    case 'message':
      return tr('ui.timeline.message', { direction: directionLabel(data.direction ?? ''), channel: channelLabel(data.channel ?? ''), summary: data.summary ?? '' });
    case 'meeting':
      return tr('ui.timeline.meeting', { summary: data.summary ?? '' });
    case 'homework':
      return data.direction === 'outgoing' ? tr('ui.timeline.homeworkOut', { summary: data.summary ?? '' }) : tr('ui.timeline.homeworkIn', { summary: data.summary ?? '' });
    case 'confirmation':
      return tr('ui.timeline.confirmation', { summary: data.summary ?? '' });
    case 'document':
      return tr('ui.timeline.document', { type: documentTypeLabel(data.type ?? '') });
    case 'pdf':
      return tr('ui.timeline.pdf', { type: documentTypeLabel(data.type ?? '') });
    case 'reminder':
      return data.state === 'done' ? tr('ui.timeline.reminderDone', { text: data.text ?? '' }) : tr('ui.timeline.reminderCreated', { text: data.text ?? '' });
  }
}

/** The grey second line of an entry: the channel (and for a meeting who set it up); a message has all of it in its title. */
export function eventSubline(event: TimelineEvent): string {
  const channel = channelLabel(event.data.channel ?? '');
  switch (event.type) {
    case 'meeting':
      return `${channel} · ${directionLabelFor('meeting', event.data.direction ?? '')}`;
    case 'homework':
    case 'confirmation':
      return channel;
    default:
      return '';
  }
}
