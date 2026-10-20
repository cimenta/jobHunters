<script lang="ts">
  import type { MdBlock, MdInline } from '@jobhunters/core';

  /** Draws the tree that parseMarkdown made, with ordinary elements: the typed text is never turned into markup. */
  let { blocks }: { blocks: MdBlock[] } = $props();
</script>

{#snippet inlines(nodes: MdInline[])}
  {#each nodes as node, index (index)}
    {#if node.t === 'text'}{node.text}
    {:else if node.t === 'strong'}<strong>{@render inlines(node.children)}</strong>
    {:else if node.t === 'em'}<em>{@render inlines(node.children)}</em>
    {:else if node.t === 'code'}<code>{node.text}</code>
    {:else if node.t === 'link'}<a data-ui="markdown.link" href={node.href} target="_blank" rel="noopener noreferrer">{@render inlines(node.children)}</a>
    {:else}<br>{/if}
  {/each}
{/snippet}

{#snippet draw(list: MdBlock[])}
  {#each list as block, index (index)}
    {#if block.t === 'heading'}
      <svelte:element this={`h${block.level}`}>{@render inlines(block.children)}</svelte:element>
    {:else if block.t === 'p'}
      <p>{@render inlines(block.children)}</p>
    {:else if block.t === 'list'}
      <svelte:element this={block.ordered ? 'ol' : 'ul'}>
        {#each block.items as item, itemIndex (itemIndex)}<li>{@render inlines(item)}</li>{/each}
      </svelte:element>
    {:else if block.t === 'quote'}
      <blockquote>{@render draw(block.children)}</blockquote>
    {:else if block.t === 'pre'}
      <pre><code>{block.text}</code></pre>
    {:else}
      <hr>
    {/if}
  {/each}
{/snippet}

{@render draw(blocks)}
