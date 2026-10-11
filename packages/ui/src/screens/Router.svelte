<script lang="ts">
  import { router } from '../lib/router.svelte';
  import ApplicationsScreen from './ApplicationsScreen.svelte';
  import CompaniesScreen from './CompaniesScreen.svelte';
  import Dashboard from './Dashboard.svelte';
  import JobsScreen from './JobsScreen.svelte';
  import NotFound from './NotFound.svelte';
  import Settings from './Settings.svelte';
  import TasksScreen from './TasksScreen.svelte';
</script>

{#if router.current.name === 'dashboard'}
  <Dashboard />
{:else if router.current.name === 'jobs' || router.current.name === 'job' || router.current.name === 'job-new'}
  <JobsScreen />
{:else if router.current.name === 'applications' || router.current.name === 'application'}
  <ApplicationsScreen />
{:else if router.current.name === 'companies' || router.current.name === 'company'}
  <CompaniesScreen />
{:else if router.current.name === 'tasks'}
  <TasksScreen />
{:else if router.current.name === 'settings'}
  <Settings />
{:else}
  <NotFound />
{/if}
