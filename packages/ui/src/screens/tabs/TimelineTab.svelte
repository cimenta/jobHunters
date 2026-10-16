<script lang="ts">
  import type { TimelineType } from '@jobhunters/core';
  import type { ApplicationDetail } from '../../api/types';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { directionArrow, eventIcon, isUpcoming, typeIcon } from '../../lib/entry-style';
  import { formatDate } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { describeEvent, eventHoverText, eventSubline } from '../../lib/timeline';
  import DeleteApplicationDialog from '../DeleteApplicationDialog.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const TYPES: TimelineType[] = ['status', 'message', 'meeting', 'after_meeting', 'homework', 'confirmation', 'document', 'pdf', 'reminder'];
  let hidden = $state<TimelineType[]>([]);
  let newestFirst = $state(true);
  let deleting = $state(false);
  // The hover card is drawn only for the icon the pointer or the keyboard is on, so the text is not in the page twice.
  let tipFor = $state<number>();
  const now = Date.now();

  function typeLabel(type: TimelineType): string {
    return tr(`ui.timeline.type.${type}`);
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
      <button data-ui="timeline.filter.{type}" type="button" class="chip" class:off={hidden.includes(type)} aria-pressed={!hidden.includes(type)} onclick={() => toggle(type)}><span class="t-{type}"><Icon name={typeIcon(type)} size={16} /></span>{typeLabel(type)}</button>
    {/each}
    <span class="grow"></span>
    <Button ui="timeline.order" onclick={() => (newestFirst = !newestFirst)}>{newestFirst ? tr('ui.timeline.oldest') : tr('ui.timeline.newest')}</Button>
  </div>

  {#if events.length === 0}
    <EmptyState ui="timeline.empty" icon="clock" title={tr('ui.timeline.empty')} />
  {:else}
    <ul class="list">
      {#each events as event, index (index)}
        {@const arrow = directionArrow(event.data.direction ?? '', event.type)}
        {@const subline = eventSubline(event)}
        {@const upcoming = isUpcoming(event, now)}
        {@const hover = eventHoverText(event)}
        <li class="list-item event" class:upcoming data-ui="timeline.event.{index}" data-type={event.type}>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
          <span class="ico t-{event.type}" data-ui="timeline.event.{index}.icon" tabindex={hover ? 0 : undefined} aria-describedby={hover && tipFor === index ? `timeline-tip-${index}` : undefined} onmouseenter={() => hover && (tipFor = index)} onmouseleave={() => (tipFor = undefined)} onfocus={() => hover && (tipFor = index)} onblur={() => (tipFor = undefined)}>
            <Icon name={eventIcon(event)} size={18} />
            {#if arrow}<span class="dir"><Icon name={arrow} size={10} /></span>{/if}
            {#if hover && tipFor === index}
              <span class="tip" role="tooltip" id="timeline-tip-{index}" data-ui="timeline.event.{index}.tip">
                {#if hover.summary !== ''}<strong data-ui="timeline.event.{index}.tip.summary">{hover.summary}</strong>{/if}
                {#if hover.details !== ''}<span class="tip-details" data-ui="timeline.event.{index}.tip.details">{hover.details}</span>{/if}
              </span>
            {/if}
          </span>
          <span class="grow body">
            <span>{describeEvent(event)}{#if upcoming}<span class="badge-upcoming" data-ui="timeline.event.{index}.upcoming">{tr('ui.timeline.upcoming')}</span>{/if}</span>
            {#if subline !== ''}<span class="muted small">{subline}</span>{/if}
          </span>
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
  .chip { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); font: inherit; color: var(--text); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 999px; cursor: pointer; }
  .danger-zone { padding-top: var(--space-4); border-top: 1px solid var(--border); }
  .chip.off { color: var(--text-muted); background: transparent; border-color: var(--border); text-decoration: line-through; }
  .event { align-items: flex-start; gap: var(--space-3); }
  .event.upcoming { background: color-mix(in srgb, var(--kind-meeting) 8%, var(--surface)); }
  .body { display: flex; flex-direction: column; min-width: 0; }
  .ico { position: relative; flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: color-mix(in srgb, currentColor 14%, transparent); }
  .tip { display: flex; position: absolute; left: 44px; top: -6px; z-index: 5; width: max-content; max-width: min(320px, 70vw); flex-direction: column; gap: var(--space-1); padding: var(--space-2) var(--space-3); font-size: var(--text-s); line-height: 1.4; color: var(--text); text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); box-shadow: var(--shadow-2); }
  .tip-details { color: var(--text-muted); white-space: pre-wrap; }
  .dir { position: absolute; right: -4px; bottom: -4px; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
  .badge-upcoming { margin-left: var(--space-2); padding: 1px 8px; font-size: var(--text-s); color: var(--text); border: 1px solid var(--kind-meeting); border-radius: 999px; }
  .t-status, .t-document, .t-pdf { color: var(--text-muted); }
  .t-message, .t-after_meeting { color: var(--accent); }
  .t-meeting { color: var(--kind-meeting); }
  .t-homework, .t-reminder { color: var(--warning); }
  .t-confirmation { color: var(--success); }
  .chip .t-status, .chip .t-document, .chip .t-pdf, .chip .t-message, .chip .t-after_meeting, .chip .t-meeting, .chip .t-homework, .chip .t-reminder, .chip .t-confirmation { display: inline-flex; }
</style>
