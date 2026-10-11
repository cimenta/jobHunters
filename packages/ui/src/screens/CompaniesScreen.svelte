<script lang="ts">
  import MasterDetail from '../layout/MasterDetail.svelte';
  import { router } from '../lib/router.svelte';
  import CompaniesList from './CompaniesList.svelte';
  import CompanyDetail from './CompanyDetail.svelte';
</script>

<MasterDetail hasDetail={router.current.name === 'company'}>
  {#snippet list()}<CompaniesList />{/snippet}
  {#snippet detail()}<CompanyDetail id={router.current.id ?? ''} />{/snippet}
</MasterDetail>
