<script lang="ts">
  import { CUSTOM_LOAD_BODY_MAX, type CustomLoadFailure } from '@jobhunters/core';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { toast } from '../state/toast.svelte';

  interface Props {
    failure: CustomLoadFailure | undefined;
    onclose: () => void;
  }
  let { failure, onclose }: Props = $props();

  const requestText = $derived(
    failure === undefined
      ? ''
      : [`${failure.request.method} ${failure.request.url}`, ...Object.entries(failure.request.headers).map(([name, value]) => `${name}: ${value}`)].join('\n'),
  );

  const responseText = $derived.by(() => {
    if (failure === undefined) return '';
    const { status, body, truncated, error } = failure.response;
    if (status === 0) return [tr('ui.customLoadFailure.noResponse'), error].filter((line) => line !== '').join('\n');
    const lines = [`HTTP ${status}`];
    if (body.trim() === '') lines.push('', tr('ui.customLoadFailure.emptyBody'));
    else lines.push('', body);
    if (truncated) lines.push('', tr('ui.customLoadFailure.truncated', { max: CUSTOM_LOAD_BODY_MAX }));
    return lines.join('\n');
  });

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(`${tr('ui.customLoadFailure.request')}\n${requestText}\n\n${tr('ui.customLoadFailure.response')}\n${responseText}`);
    toast.success(tr('ui.copied'));
  }
</script>

<Dialog open={failure !== undefined} title={tr('ui.customLoadFailure.title')} ui="custom-load-failure" {onclose}>
  {#if failure}
    <div class="stack">
      <p class="reason" data-ui="custom-load-failure.reason">{tr(`error.${failure.code}`, failure.params)}</p>
      <div class="stack-s">
        <h3>{tr('ui.customLoadFailure.request')}</h3>
        <pre data-ui="custom-load-failure.request">{requestText}</pre>
      </div>
      <div class="stack-s">
        <h3>{tr('ui.customLoadFailure.response')}</h3>
        <pre data-ui="custom-load-failure.response">{responseText}</pre>
      </div>
      <small class="muted">{tr('ui.customLoadFailure.keyHidden')}</small>
    </div>
  {/if}
  {#snippet footer()}
    <Button ui="custom-load-failure.copy" onclick={copy}>{tr('ui.customLoadFailure.copy')}</Button>
    <Button variant="primary" ui="custom-load-failure.close" onclick={onclose}>{tr('ui.customLoadFailure.close')}</Button>
  {/snippet}
</Dialog>

<style>
  .stack-s { display: flex; flex-direction: column; gap: var(--space-1); }
  h3 { margin: 0; font-size: var(--text-s); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .reason { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-s); font-weight: 600; color: var(--danger); background: var(--danger-soft); }
  pre { margin: 0; padding: var(--space-2) var(--space-3); max-height: 220px; overflow: auto; font-size: var(--text-s); white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface-2); border-radius: var(--radius-s); }
</style>
