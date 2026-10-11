<script lang="ts">
  import MasterDetail from '../layout/MasterDetail.svelte';
  import { router } from '../lib/router.svelte';
  import AddJob from './AddJob.svelte';
  import JobDetail from './JobDetail.svelte';
  import JobsList from './JobsList.svelte';

  const hasDetail = $derived(router.current.name === 'job-new' || router.current.name === 'job');
</script>

<MasterDetail {hasDetail}>
  {#snippet list()}<JobsList />{/snippet}
  {#snippet detail()}
    {#if router.current.name === 'job-new'}
      <AddJob />
    {:else}
      <JobDetail id={router.current.id ?? ''} />
    {/if}
  {/snippet}
</MasterDetail>
