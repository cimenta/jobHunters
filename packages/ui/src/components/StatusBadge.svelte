<script lang="ts">
  import { statusStyle } from '../lib/status';
  import Badge from './Badge.svelte';

  let { status }: { status: string } = $props();
  const style = $derived(statusStyle(status));
</script>

<Badge text={style.text} color={style.color} textColor={style.textColor} />
