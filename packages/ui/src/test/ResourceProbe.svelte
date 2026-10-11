<script lang="ts">
  import { useResource } from '../lib/resource.svelte';

  let { load, id }: { load: (id: string) => Promise<string>; id: string } = $props();
  const resource = useResource(() => load(id), () => id);
</script>

<p data-testid="status">{resource.status}</p>
<p data-testid="data">{resource.data ?? ''}</p>
<p data-testid="error">{resource.error ? 'failed' : ''}</p>
