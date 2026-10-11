import { toast } from '../state/toast.svelte';
import { describeError } from './errors';

export function notifyError(error: unknown): void {
  toast.error(describeError(error));
}
