<script lang="ts">
  let { text, color, textColor }: { text: string; color: string; textColor: string } = $props();
</script>

<span class="badge" style:background-color={color} style:color={textColor}>{text}</span>

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
