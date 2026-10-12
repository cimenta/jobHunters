<script lang="ts">
  import EmptyState from '../components/EmptyState.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
</script>

<EmptyState ui="not-found.empty" icon="search" title={tr('ui.notFound.title')} text={tr('ui.notFound.text')}>
  <a data-ui="not-found.home" href={paths.dashboard}>{tr('ui.notFound.home')}</a>
</EmptyState>
