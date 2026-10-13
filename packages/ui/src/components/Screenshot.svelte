<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import Dialog from './Dialog.svelte';

  interface Props {
    /** The image (imported, so it is part of the single-file build). */
    src: string;
    /** What the screenshot shows, for screen readers and as the caption. */
    caption: string;
    /** Identifier shown by the identifier labels (data-ui). */
    ui: string;
  }
  let { src, caption, ui }: Props = $props();

  let open = $state(false);
</script>

<figure data-ui={ui}>
  <button type="button" class="shot" aria-label={tr('ui.help.shotEnlarge', { caption })} title={tr('ui.help.shotEnlarge', { caption })} data-ui="{ui}.zoom" onclick={() => (open = true)}>
    <img {src} alt={caption} />
  </button>
  <figcaption class="muted small">{caption}</figcaption>
</figure>
<Dialog {open} title={caption} wide ui="help.shot-dialog" onclose={() => (open = false)}>
  <img class="big" {src} alt={caption} />
</Dialog>

<style>
  figure { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; min-width: 0; }
  .shot { display: block; width: 100%; box-sizing: border-box; padding: 0; background: none; border: 1px solid var(--border); border-radius: var(--radius-s); overflow: hidden; cursor: zoom-in; }
  .shot:hover, .shot:focus-visible { border-color: var(--accent); }
  img { display: block; width: 100%; height: auto; }
  .big { border: 1px solid var(--border); border-radius: var(--radius-s); }
</style>
