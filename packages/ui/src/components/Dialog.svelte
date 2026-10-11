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
    /** Identifier shown by the identifier labels (data-ui). */
    ui?: string;
  }
  let { open, title, onclose, children, footer, ui }: Props = $props();

  let panel = $state<HTMLElement>();

  $effect(() => {
    if (!open || !panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.querySelector<HTMLElement>('input, select, textarea') ?? panel;
    first.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
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
    <div class="panel" role="dialog" aria-modal="true" aria-label={title} data-ui={ui} tabindex="-1" bind:this={panel} {onkeydown}>
      <header>
        <h2>{title}</h2>
        <Button variant="ghost" label={tr('ui.close')} onclick={onclose}><Icon name="close" /></Button>
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
  .body { padding: var(--space-4); overflow-y: auto; }
  @media (min-width: 640px) {
    .backdrop { align-items: center; padding: var(--space-4); }
    .panel { width: min(560px, 100%); border-radius: var(--radius-l); }
  }
</style>
