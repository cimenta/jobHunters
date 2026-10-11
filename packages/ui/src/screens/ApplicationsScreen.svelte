<script lang="ts">
  import MasterDetail from '../layout/MasterDetail.svelte';
  import { router } from '../lib/router.svelte';
  import ApplicationDetail from './ApplicationDetail.svelte';
  import ApplicationsList from './ApplicationsList.svelte';
</script>

<MasterDetail hasDetail={router.current.name === 'application'}>
  {#snippet list()}<ApplicationsList />{/snippet}
  {#snippet detail()}<ApplicationDetail id={router.current.id ?? ''} />{/snippet}
</MasterDetail>
