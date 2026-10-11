<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import { ids } from '../state/ids.svelte';
  import { toast } from '../state/toast.svelte';

  interface Tag {
    id: string;
    x: number;
    y: number;
  }
  const MAX_TAGS = 300;
  const LINE = 14;

  let tags = $state<Tag[]>([]);

  function measure(): void {
    const taken = new Map<string, number>();
    const next: Tag[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('[data-ui]')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.bottom < 0 || box.top > window.innerHeight || box.right < 0 || box.left > window.innerWidth) continue;
      const x = Math.max(0, Math.round(box.left));
      const y = Math.max(0, Math.round(box.top));
      // Elements that start at the same corner (a card and its first child) get labels stacked one under the other.
      const key = `${x}:${y}`;
      const stacked = taken.get(key) ?? 0;
      taken.set(key, stacked + 1);
      next.push({ id: element.dataset.ui ?? '', x, y: y + stacked * LINE });
      if (next.length >= MAX_TAGS) break;
    }
    tags = next;
  }

  $effect(() => {
    if (!ids.visible) {
      tags = [];
      return;
    }
    measure();
    const timer = setInterval(measure, 400);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  });

  async function copy(id: string): Promise<void> {
    await navigator.clipboard.writeText(id);
    toast.success(tr('ui.copied'));
  }
</script>

{#if ids.visible}
  <div class="overlay">
    {#each tags as tag, index (index)}
      <button type="button" class="tag" data-id-tag style:left="{tag.x}px" style:top="{tag.y}px" onclick={() => copy(tag.id)}>{tag.id}</button>
    {/each}
  </div>
{/if}

<style>
  .overlay { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
  .tag {
    position: absolute;
    max-width: 260px;
    padding: 0 4px;
    overflow: hidden;
    font: 600 10px/14px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    color: #000;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: copy;
    pointer-events: auto;
    background: #fde047;
    border: 1px solid #a16207;
    border-radius: 3px;
  }
</style>
