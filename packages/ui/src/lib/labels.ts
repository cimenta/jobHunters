import { tr } from './i18n.svelte';

export function availabilityLabel(value: string): string {
  switch (value) {
    case 'online':
      return tr('ui.availability.online');
    case 'offline':
      return tr('ui.availability.offline');
    default:
      return tr('ui.availability.unknown');
  }
}

export function documentTypeLabel(type: string): string {
  switch (type) {
    case 'resume':
      return tr('document.type.resume');
    case 'cover_letter':
      return tr('document.type.cover_letter');
    default:
      return tr('document.type.other');
  }
}

export function directionLabel(value: string): string {
  switch (value) {
    case 'incoming':
      return tr('ui.direction.incoming');
    case 'outgoing':
      return tr('ui.direction.outgoing');
    case 'note':
      return tr('ui.direction.note');
    default:
      return value;
  }
}

export function channelLabel(value: string): string {
  switch (value) {
    case 'email':
      return tr('ui.channel.email');
    case 'phone':
      return tr('ui.channel.phone');
    case 'linkedin':
      return tr('ui.channel.linkedin');
    case 'in_person':
      return tr('ui.channel.in_person');
    case 'portal':
      return tr('ui.channel.portal');
    case 'other':
      return tr('ui.channel.other');
    default:
      return value;
  }
}
