import { DIRECTIONS_BY_KIND, communicationKind } from '@jobhunters/core';
import { tr } from './i18n.svelte';

/** "suspected http_gone: 404" -> a sentence in the language of the app. */
export function availabilityReasonLabel(reason: string): string {
  if (reason === '') return '';
  const suspected = reason.startsWith('suspected ');
  const body = suspected ? reason.slice('suspected '.length) : reason;
  const split = body.indexOf(': ');
  const rule = split < 0 ? body : body.slice(0, split);
  const detail = split < 0 ? '' : body.slice(split + 2);
  const known = ['http_gone', 'redirect_elsewhere', 'valid_until_past', 'offline_text', 'unknown_response'];
  const text = known.includes(rule) ? tr(`ui.availability.reason.${rule}`, { detail }) : body;
  return suspected ? tr('ui.availability.suspected', { reason: text }) : text;
}

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
    case 'video':
      return tr('ui.channel.video');
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

export function kindLabel(kind: string): string {
  return tr(`ui.kind.${communicationKind(kind)}`);
}

/** The direction in the words of the kind (meeting: "Invited by the employer"); a message keeps Incoming / Outgoing / Note. */
export function directionLabelFor(kind: string, direction: string): string {
  const known = communicationKind(kind);
  return known !== 'message' && DIRECTIONS_BY_KIND[known].includes(direction) ? tr(`ui.comm.dir.${known}.${direction}`) : directionLabel(direction);
}

/** A label of the entry dialog; a message keeps the plain label, the other kinds have their own wording. */
export function commLabel(field: 'direction' | 'summary' | 'when', kind: string): string {
  const known = communicationKind(kind);
  return known === 'message' ? tr(`ui.comm.${field}`) : tr(`ui.comm.${field}.${known}`);
}

export function sortLabel(key: string): string {
  return tr(`ui.sort.${key}`);
}

export const AI_TASK_TYPES = ['import_job', 'import_match_job', 'match_job', 'resume_tailor', 'cover_letter', 'other', 'answer_question'];

export function aiTaskTypeLabel(type: string): string {
  switch (type) {
    case 'import_job':
      return tr('ui.tasks.type.import_job');
    case 'import_match_job':
      return tr('ui.tasks.type.import_match_job');
    case 'match_job':
      return tr('ui.tasks.type.match_job');
    case 'answer_question':
      return tr('ui.tasks.type.answer_question');
    case 'resume_tailor':
      return documentTypeLabel('resume');
    case 'cover_letter':
      return documentTypeLabel('cover_letter');
    default:
      return tr('ui.tasks.type.other');
  }
}
