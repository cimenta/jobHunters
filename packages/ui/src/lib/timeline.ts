import type { TimelineEvent } from '@jobhunters/core';
import { tr } from './i18n.svelte';
import { channelLabel, directionLabel, documentTypeLabel } from './labels';
import { statusStyle } from './status';

export function describeEvent(event: TimelineEvent): string {
  const { data } = event;
  switch (event.type) {
    case 'status':
      return data.from === ''
        ? tr('ui.timeline.created')
        : tr('ui.timeline.status', { from: statusStyle(data.from ?? '').text, to: statusStyle(data.to ?? '').text });
    case 'communication':
      return tr('ui.timeline.communication', { direction: directionLabel(data.direction ?? ''), channel: channelLabel(data.channel ?? ''), summary: data.summary ?? '' });
    case 'document':
      return tr('ui.timeline.document', { type: documentTypeLabel(data.type ?? '') });
    case 'pdf':
      return tr('ui.timeline.pdf', { type: documentTypeLabel(data.type ?? '') });
    case 'reminder':
      return data.state === 'done' ? tr('ui.timeline.reminderDone', { text: data.text ?? '' }) : tr('ui.timeline.reminderCreated', { text: data.text ?? '' });
  }
}
