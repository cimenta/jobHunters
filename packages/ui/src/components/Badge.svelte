<script lang="ts">
  /** `title` is the explanation shown when the pointer rests on the badge; `ui` is the identifier shown by the identifier labels (data-ui). */
  let { text, color, textColor, title, ui }: { text: string; color: string; textColor: string; title?: string; ui?: string } = $props();
</script>

<span class="badge" {title} data-ui={ui} style:background-color={color} style:color={textColor}>{text}</span>

<style>
  .badge {
    display: inline-block;
    max-width: 100%;
    padding: 2px var(--space-3);
    font-size: var(--text-s);
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 999px;
  }
</style>
