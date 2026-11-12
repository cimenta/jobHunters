<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import type { Move } from '../lib/moves.svelte';

  interface Props {
    moves: Record<string, Move>;
    /** The text for one card that is being moved. */
    describe: (id: string, move: Move) => string;
  }
  let { moves, describe }: Props = $props();

  const active = $derived(Object.entries(moves).filter(([, move]) => !move.done));
  /** Cards that are being moved and are not on the screen now. */
  let hidden = $state<string[]>([]);

  const elementOf = (id: string): Element | null => document.querySelector(`[data-move="${id}"]`);

  /** Whether the card can be seen: inside the window and inside the part of the board that is not scrolled away. */
  function visible(id: string): boolean {
    const el = elementOf(id);
    if (el === null) return false;
    const rect = el.getBoundingClientRect();
    const view = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
    const board = el.closest('[data-board]')?.getBoundingClientRect() ?? view;
    return rect.bottom > Math.max(view.top, board.top) && rect.top < Math.min(view.bottom, board.bottom) && rect.right > Math.max(view.left, board.left) && rect.left < Math.min(view.right, board.right);
  }

  $effect(() => {
    const ids = active.map(([id]) => id);
    if (ids.length === 0) {
      hidden = [];
      return;
    }
    const update = (): void => {
      hidden = ids.filter((id) => !visible(id));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const timer = setInterval(update, 300);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      clearInterval(timer);
    };
  });

  /** A move that has ended is gone from moves; the list of hidden cards catches up with the next check. */
  const shown = $derived(hidden.filter((id) => moves[id] !== undefined));
  const text = $derived(shown.length === 1 ? describe(shown[0]!, moves[shown[0]!]!) : tr('ui.moving.pillMany', { count: shown.length }));

  function show(): void {
    elementOf(shown[0]!)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }
</script>

{#if shown.length > 0}
  <button type="button" class="pill" aria-live="polite" data-ui="moving.pill" onclick={show}><i class="spin" aria-hidden="true"></i><span>{text}</span></button>
{/if}

<style>
  .pill { position: fixed; left: 50%; bottom: calc(var(--space-4) + 120px); transform: translateX(-50%); z-index: 55; display: flex; align-items: center; gap: var(--space-3); max-width: calc(100vw - 2 * var(--space-4)); padding: var(--space-3) var(--space-4); font: inherit; font-weight: 600; text-align: left; color: var(--on-accent); background: var(--accent); border: 0; border-radius: 999px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); cursor: pointer; }
  .spin { flex: none; width: 16px; height: 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: translateX(0) rotate(360deg); } }
  @media (min-width: 640px) { .pill { bottom: var(--space-4); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 3s; } }
</style>
