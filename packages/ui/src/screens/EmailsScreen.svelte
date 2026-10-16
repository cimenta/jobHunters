<script lang="ts">
  import MasterDetail from '../layout/MasterDetail.svelte';
  import { router } from '../lib/router.svelte';
  import EmailDetail from './EmailDetail.svelte';
  import EmailsList from './EmailsList.svelte';
</script>

<MasterDetail hasDetail={router.current.name === 'email'}>
  {#snippet list()}<EmailsList />{/snippet}
  {#snippet detail()}<EmailDetail id={router.current.id ?? ''} />{/snippet}
</MasterDetail>
