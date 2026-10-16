import type { AiTask } from '@jobhunters/core';
import { tr } from './i18n.svelte';

/** The sentence for the state of a match evaluation task. */
export function matchStatusText(task: AiTask): string {
  switch (task.status) {
    case 'pending':
      return tr('ui.match.pending');
    case 'in_progress':
      return tr('ui.match.inProgress');
    case 'failed':
      return tr('ui.match.failed');
    case 'needs_input':
      return tr('ui.match.needsInput');
    default:
      return tr('ui.match.done');
  }
}
