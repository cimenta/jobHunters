<script lang="ts">
  import { foldDiacritics } from '@jobhunters/core';
  import { api } from '../api';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { router } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';

  const companies = useResource(() => api.listCompanies());
  let text = $state('');

  const rows = $derived.by(() => {
    const needle = foldDiacritics(text.trim()).toLowerCase();
    return (companies.data ?? []).filter((company) => needle === '' || foldDiacritics(company.name).toLowerCase().includes(needle));
  });
</script>

<div class="stack" data-ui="companies">
  <div class="page-title"><h1>{tr('ui.nav.companies')}</h1></div>

  {#if companies.status === 'loading'}
    <Skeleton lines={5} />
  {:else if companies.status === 'error'}
    <ErrorBlock error={companies.error} onretry={invalidate} />
  {:else if (companies.data ?? []).length === 0}
    <EmptyState ui="companies.empty" icon="building" title={tr('ui.companies.emptyTitle')} text={tr('ui.companies.emptyText')} />
  {:else}
    <Field label={tr('ui.jobs.search')} for="company-search"><input data-ui="companies.search" id="company-search" class="input" type="search" bind:value={text} /></Field>
    {#if rows.length === 0}
      <EmptyState ui="companies.no-match" title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')} />
    {:else}
      <ul class="list" data-ui="companies.list">
        {#each rows as company (company.id)}
          <li>
            <a class="list-item" data-ui="company.{company.id}" href={paths.company(company.id)} aria-current={router.current.id === company.id ? 'true' : undefined}>
              <span class="grow body">
                <span class="name">{company.name}</span>
                <span class="muted small">{tr('ui.company.jobCount', { count: company.job_count })} · {tr('summary.applications', { count: company.application_count })}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .body { display: flex; flex-direction: column; gap: 2px; }
  .name { font-weight: 600; }
</style>
