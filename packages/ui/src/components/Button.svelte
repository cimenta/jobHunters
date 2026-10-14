<script lang="ts">
  import type { Snippet } from 'svelte';
  import { notifyError } from '../lib/notify';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    loading?: boolean;
    full?: boolean;
    label?: string;
    /** Identifier shown by the identifier labels (data-ui). */
    ui?: string;
    /** With an address the button is drawn as a link (for a download or a page) but looks and sizes like a button. */
    href?: string;
    target?: string;
    rel?: string;
    onclick?: (event: MouseEvent) => unknown;
    children?: Snippet;
  }
  let { variant = 'secondary', type = 'button', disabled = false, loading = false, full = false, label, ui, href, target, rel, onclick, children }: Props = $props();

  let busy = $state(false);

  async function handle(event: MouseEvent): Promise<void> {
    if (busy || disabled || loading || !onclick) return;
    const result = onclick(event);
    if (result instanceof Promise) {
      busy = true;
      try {
        await result;
      } catch (error) {
        notifyError(error);
      } finally {
        busy = false;
      }
    }
  }
</script>

{#if href !== undefined}
  <a class="btn {variant}" class:full {href} {target} {rel} aria-label={label} title={label} data-ui={ui}>{@render children?.()}</a>
{:else}
  <button class="btn {variant}" class:full {type} disabled={disabled || busy || loading} aria-busy={busy || loading} aria-label={label} title={label} data-ui={ui} onclick={handle}>
    {#if busy || loading}<span class="spinner" aria-hidden="true"></span>{/if}
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-4);
    font: inherit;
    font-weight: 600;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-s);
    cursor: pointer;
    text-decoration: none;
  }
  .btn:hover:not(:disabled) { border-color: var(--accent); }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .primary { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  .primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
  .danger { color: var(--danger); border-color: var(--danger); }
  .danger:hover:not(:disabled) { background: var(--danger-soft); border-color: var(--danger); }
  .ghost { background: transparent; border-color: transparent; }
  .full { width: 100%; }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
