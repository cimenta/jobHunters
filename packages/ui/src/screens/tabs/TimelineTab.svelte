<script lang="ts">
  import type { TimelineType } from '@jobhunters/core';
  import type { ApplicationDetail } from '../../api/types';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { describeEvent } from '../../lib/timeline';
  import DeleteApplicationDialog from '../DeleteApplicationDialog.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const TYPES: TimelineType[] = ['status', 'communication', 'document', 'pdf', 'reminder'];
  let hidden = $state<TimelineType[]>([]);
  let newestFirst = $state(true);
  let deleting = $state(false);

  function typeLabel(type: TimelineType): string {
    switch (type) {
      case 'status':
        return tr('ui.timeline.type.status');
      case 'communication':
        return tr('ui.timeline.type.communication');
      case 'document':
        return tr('ui.timeline.type.document');
      case 'pdf':
        return tr('ui.timeline.type.pdf');
      case 'reminder':
        return tr('ui.timeline.type.reminder');
    }
  }

  function toggle(type: TimelineType): void {
    hidden = hidden.includes(type) ? hidden.filter((entry) => entry !== type) : [...hidden, type];
  }

  const events = $derived.by(() => {
    const visible = detail.timeline.filter((event) => !hidden.includes(event.type));
    return newestFirst ? [...visible].reverse() : visible;
  });
</script>

<div class="stack" data-ui="timeline">
  <div class="row wrap" data-ui="timeline.filters">
    {#each TYPES as type (type)}
      <button type="button" class="chip" class:off={hidden.includes(type)} aria-pressed={!hidden.includes(type)} onclick={() => toggle(type)}>{typeLabel(type)}</button>
    {/each}
    <span class="grow"></span>
    <Button onclick={() => (newestFirst = !newestFirst)}>{newestFirst ? tr('ui.timeline.oldest') : tr('ui.timeline.newest')}</Button>
  </div>

  {#if events.length === 0}
    <EmptyState icon="clock" title={tr('ui.timeline.empty')} />
  {:else}
    <ul class="list">
      {#each events as event, index (index)}
        <li class="list-item" data-ui="timeline.event.{index}">
          <span class="grow">{describeEvent(event)}</span>
          <span class="muted small">{formatDate(event.at)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="danger-zone" data-ui="timeline.danger-zone">
    <Button variant="danger" ui="timeline.delete-application" onclick={() => (deleting = true)}><Icon name="trash" size={16} />{tr('ui.deleteApp.button')}</Button>
  </div>
</div>

<DeleteApplicationDialog open={deleting} application={detail.application} onclose={() => (deleting = false)} />

<style>
  .chip { min-height: var(--tap); padding: 0 var(--space-3); font: inherit; color: var(--text); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 999px; cursor: pointer; }
  .danger-zone { padding-top: var(--space-4); border-top: 1px solid var(--border); }
  .chip.off { color: var(--text-muted); background: transparent; border-color: var(--border); text-decoration: line-through; }
</style>
