<script lang="ts" module>
  // Shared by every open dialog: the first one remembers the original scroll style, the last one restores it.
  let locks = 0;
  let originalOverflow = '';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children?: Snippet;
    footer?: Snippet;
    /** Small controls next to the title (left of the close button). */
    headerExtra?: Snippet;
    /** Identifier shown by the identifier labels (data-ui). */
    ui?: string;
    /** Wider panel (up to 960px) on large screens. */
    wide?: boolean;
  }
  let { open, title, onclose, children, footer, headerExtra, ui, wide = false }: Props = $props();

  let panel = $state<HTMLElement>();

  $effect(() => {
    if (!open || !panel) return;
    const mine = panel;
    const previous = document.activeElement as HTMLElement | null;
    const first = mine.querySelector<HTMLElement>('input, select, textarea') ?? mine;
    first.focus();
    if (locks === 0) originalOverflow = document.body.style.overflow;
    locks += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      locks -= 1;
      if (locks === 0) {
        document.body.style.overflow = originalOverflow;
        // Focus goes back only when the last dialog closes, and never steals it from a panel that is still open.
        if (!document.activeElement || document.activeElement === document.body || mine.contains(document.activeElement)) previous?.focus?.();
      }
    };
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    event.stopPropagation();
    const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={(event) => event.target === event.currentTarget && onclose()}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="panel" class:wide role="dialog" aria-modal="true" aria-label={title} data-ui={ui} tabindex="-1" bind:this={panel} {onkeydown}>
      <header>
        <div class="title"><h2>{title}</h2>{@render headerExtra?.()}</div>
        <Button ui={ui ? `${ui}.close` : undefined} variant="ghost" label={tr('ui.close')} onclick={onclose}><Icon name="close" /></Button>
      </header>
      <div class="body">{@render children?.()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(0 0 0 / 0.5);
  }
  .panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 92dvh;
    background: var(--surface);
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    box-shadow: var(--shadow-2);
  }
  header, footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); }
  footer { justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid var(--border); }
  header { border-bottom: 1px solid var(--border); }
  .title { display: flex; align-items: center; gap: var(--space-3); min-width: 0; flex-wrap: wrap; }
  .body { padding: var(--space-4); overflow-y: auto; }
  @media (min-width: 640px) {
    .backdrop { align-items: center; padding: var(--space-4); }
    .panel { width: min(560px, 100%); border-radius: var(--radius-l); }
    .panel.wide { width: min(960px, 100%); }
  }
</style>
