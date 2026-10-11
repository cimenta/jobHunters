<script lang="ts">
  import Tabs from '../components/Tabs.svelte';

  let active = $state('a');
  const items = [
    { id: 'a', label: 'First' },
    { id: 'b', label: 'Second', count: 2 },
    { id: 'c', label: 'Third' },
  ];
</script>

<Tabs {items} bind:active label="Sections" />
<p data-testid="active">{active}</p>
