<script lang="ts">
  import Dialog from '../components/Dialog.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import AddJob from './AddJob.svelte';
  import JobDetail from './JobDetail.svelte';
  import JobsList from './JobsList.svelte';
</script>

<JobsList />

<Dialog open={router.current.name === 'job'} wide ui="job-dialog" title={tr('ui.job.detailTitle')} onclose={() => navigate(paths.jobs)}>
  <JobDetail id={router.current.id ?? ''} />
</Dialog>

<Dialog open={router.current.name === 'job-new'} wide backdropCloses={false} ui="add-job-dialog" title={tr('ui.addJob.title')} onclose={() => navigate(paths.jobs)}>
  <AddJob />
</Dialog>
