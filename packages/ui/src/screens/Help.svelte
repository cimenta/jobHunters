<script lang="ts">
  import Card from '../components/Card.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';

  let tab = $state('how');
</script>

<div class="stack-lg" data-ui="help">
  <div class="page-title"><h1>{tr('ui.help.title')}</h1></div>
  <Tabs
    items={[
      { id: 'how', label: tr('ui.help.how.title') },
      { id: 'dashboard', label: tr('ui.help.dashboard.title') },
      { id: 'jobs', label: tr('ui.help.jobs.title') },
      { id: 'applications', label: tr('ui.help.applications.title') },
      { id: 'companies', label: tr('ui.help.companies.title') },
      { id: 'tasks', label: tr('ui.help.tasks.title') },
      { id: 'settings', label: tr('ui.help.settings.title') },
      { id: 'tips', label: tr('ui.help.tips.title') },
    ]}
    bind:active={tab}
    label={tr('ui.help.tabs')}
  />
  <div class="stack-lg" role="tabpanel" data-ui="help.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
  {#if tab === 'how'}
  <Card ui="help.how">
    <h2>{tr('ui.help.how.title')}</h2>
    <p>{tr('ui.help.how.intro')}</p>
    <ol>
      <li>{tr('ui.help.how.i1')}</li>
      <li>{tr('ui.help.how.i2')}</li>
      <li>{tr('ui.help.how.i3')}</li>
      <li>{tr('ui.help.how.i4')}</li>
      <li>{tr('ui.help.how.i5')}</li>
      <li>{tr('ui.help.how.i6')}</li>
    </ol>
  </Card>
  {:else if tab === 'dashboard'}
  <Card ui="help.dashboard">
    <h2>{tr('ui.help.dashboard.title')}</h2>
    <p>{tr('ui.help.dashboard.intro')}</p>
    <ul>
      <li>{tr('ui.help.dashboard.i1')}</li>
      <li>{tr('ui.help.dashboard.i2')}</li>
      <li>{tr('ui.help.dashboard.i3')}</li>
      <li>{tr('ui.help.dashboard.i4')}</li>
    </ul>
    <p><a data-ui="help.open.dashboard" href={paths.dashboard}>{tr('ui.help.open', { name: tr('ui.help.dashboard.title') })}</a></p>
  </Card>
  {:else if tab === 'jobs'}
  <Card ui="help.jobs">
    <h2>{tr('ui.help.jobs.title')}</h2>
    <p>{tr('ui.help.jobs.intro')}</p>
    <ul>
      <li>{tr('ui.help.jobs.i1')}</li>
      <li>{tr('ui.help.jobs.i2')}</li>
      <li>{tr('ui.help.jobs.i3')}</li>
      <li>{tr('ui.help.jobs.i4')}</li>
      <li>{tr('ui.help.jobs.i5')}</li>
      <li>{tr('ui.help.jobs.i6')}</li>
      <li>{tr('ui.help.jobs.i7')}</li>
      <li>{tr('ui.help.jobs.i8')}</li>
      <li>{tr('ui.help.jobs.i9')}</li>
      <li>{tr('ui.help.jobs.i10')}</li>
    </ul>
    <p><a data-ui="help.open.jobs" href={paths.jobs}>{tr('ui.help.open', { name: tr('ui.help.jobs.title') })}</a></p>
  </Card>
  {:else if tab === 'applications'}
  <Card ui="help.applications">
    <h2>{tr('ui.help.applications.title')}</h2>
    <p>{tr('ui.help.applications.intro')}</p>
    <ul>
      <li>{tr('ui.help.applications.i1')}</li>
      <li>{tr('ui.help.applications.i2')}</li>
      <li>{tr('ui.help.applications.i3')}</li>
      <li>{tr('ui.help.applications.i4')}</li>
      <li>{tr('ui.help.applications.i5')}</li>
    </ul>
    <p><a data-ui="help.open.applications" href={paths.applications}>{tr('ui.help.open', { name: tr('ui.help.applications.title') })}</a></p>
  </Card>
  {:else if tab === 'companies'}
  <Card ui="help.companies">
    <h2>{tr('ui.help.companies.title')}</h2>
    <p>{tr('ui.help.companies.intro')}</p>
    <ul>
      <li>{tr('ui.help.companies.i1')}</li>
    </ul>
    <p><a data-ui="help.open.companies" href={paths.companies}>{tr('ui.help.open', { name: tr('ui.help.companies.title') })}</a></p>
  </Card>
  {:else if tab === 'tasks'}
  <Card ui="help.tasks">
    <h2>{tr('ui.help.tasks.title')}</h2>
    <p>{tr('ui.help.tasks.intro')}</p>
    <ul>
      <li>{tr('ui.help.tasks.i1')}</li>
      <li>{tr('ui.help.tasks.i2')}</li>
      <li>{tr('ui.help.tasks.i3')}</li>
    </ul>
    <p><a data-ui="help.open.tasks" href={paths.tasks}>{tr('ui.help.open', { name: tr('ui.help.tasks.title') })}</a></p>
  </Card>
  {:else if tab === 'settings'}
  <Card ui="help.settings">
    <h2>{tr('ui.help.settings.title')}</h2>
    <p>{tr('ui.help.settings.intro')}</p>
    <ul>
      <li>{tr('ui.help.settings.i1')}</li>
      <li>{tr('ui.help.settings.i2')}</li>
      <li>{tr('ui.help.settings.i3')}</li>
      <li>{tr('ui.help.settings.i4')}</li>
      <li>{tr('ui.help.settings.i5')}</li>
      <li>{tr('ui.help.settings.i6')}</li>
      <li>{tr('ui.help.settings.i7')}</li>
      <li>{tr('ui.help.settings.i8')}</li>
      <li>{tr('ui.help.settings.i9')}</li>
      <li>{tr('ui.help.settings.i10')}</li>
      <li>{tr('ui.help.settings.i11')}</li>
    </ul>
    <p><a data-ui="help.open.settings" href={paths.settings}>{tr('ui.help.open', { name: tr('ui.help.settings.title') })}</a></p>
  </Card>
  {:else if tab === 'tips'}
  <Card ui="help.tips">
    <h2>{tr('ui.help.tips.title')}</h2>
    <ul>
      <li>{tr('ui.help.tips.i1')}</li>
      <li>{tr('ui.help.tips.i2')}</li>
      <li>{tr('ui.help.tips.i3')}</li>
      <li>{tr('ui.help.tips.i4')}</li>
    </ul>
  </Card>
  {/if}
  </div>
</div>

<style>
  ul, ol { margin: 0; padding-inline-start: var(--space-5); display: flex; flex-direction: column; gap: var(--space-1); }
</style>
