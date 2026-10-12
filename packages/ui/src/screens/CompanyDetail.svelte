<script lang="ts">
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getCompany(id), () => id);
  let name = $state('');
  let website = $state('');
  let notes = $state('');

  $effect(() => {
    const company = detail.data?.company;
    if (company) {
      name = company.name;
      website = company.website;
      notes = company.notes;
    }
  });

  async function save(): Promise<void> {
    await api.updateCompany(id, { name, website, notes });
    toast.success(tr('ui.company.saved', { name }));
    invalidate();
  }
</script>

<div class="stack" data-ui="company-detail">
  <div class="only-narrow">
    <Button variant="ghost" onclick={() => navigate(paths.companies)}><Icon name="back" size={18} />{tr('ui.back')}</Button>
  </div>

  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    <Card ui="company-detail.form">
      <h1>{detail.data.company.name}</h1>
      <Field label={tr('ui.company.name')} for="company-name"><input id="company-name" class="input" bind:value={name} /></Field>
      <Field label={tr('ui.company.website')} for="company-website"><input id="company-website" class="input" inputmode="url" bind:value={website} /></Field>
      <Field label={tr('ui.company.notes')} for="company-notes"><textarea id="company-notes" class="input" rows="3" bind:value={notes}></textarea></Field>
      <div><Button variant="primary" ui="company-detail.save" onclick={save}>{tr('ui.save')}</Button></div>
    </Card>

    <Card ui="company-detail.jobs">
      <h2>{tr('ui.company.jobs')}</h2>
      {#if detail.data.jobs.length === 0}
        <p class="muted">{tr('ui.company.noJobs')}</p>
      {:else}
        <ul class="list">
          {#each detail.data.jobs as job (job.id)}
            <li><a class="list-item" href={paths.job(job.id)}><span class="grow">{job.title}</span></a></li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card ui="company-detail.applications">
      <h2>{tr('ui.company.applications')}</h2>
      <ul class="list">
        {#each detail.data.applications as application (application.id)}
          <li>
            <a class="list-item" href={paths.application(application.id)}>
              <span class="grow">{application.label}</span>
              <StatusBadge status={application.status} />
            </a>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
</div>
