<script lang="ts">
  import Dialog from '../components/Dialog.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import ApplicationDetail from './ApplicationDetail.svelte';
  import ApplicationsList from './ApplicationsList.svelte';
</script>

<ApplicationsList />

<Dialog open={router.current.name === 'application'} wide ui="application-dialog" title={tr('ui.app.detailTitle')} onclose={() => navigate(paths.applications)}>
  <ApplicationDetail id={router.current.id ?? ''} />
</Dialog>
