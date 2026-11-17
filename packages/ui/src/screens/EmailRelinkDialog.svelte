<script lang="ts">
  import { untrack } from 'svelte';
  import { api } from '../api';
  import type { EmailDetail } from '../api/types';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import SearchSelect, { type SearchOption } from '../components/SearchSelect.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { statusStyle } from '../lib/status';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  /** Moves a saved e-mail, and the entry it made, to another application or job. `from` is the name of what it belongs to now. */
  let { detail, from, onclose }: { detail: EmailDetail; from: string; onclose: () => void } = $props();

  const email = $derived(detail.email);
  const applications = useResource(() => api.listApplications());
  const jobs = useResource(() => api.listJobs());

  const current = untrack(() => (detail.email.application_id !== '' ? `a:${detail.email.application_id}` : detail.email.job_id !== '' ? `j:${detail.email.job_id}` : ''));
  let target = $state(current);

  const reasons = $derived(new Map((detail.suggestion?.candidates ?? []).map((candidate) => [candidate.applicationId !== '' ? `a:${candidate.applicationId}` : `j:${candidate.jobId}`, candidate.method])));
  const options = $derived.by((): SearchOption[] => {
    const apps = applications.data ?? [];
    const standalone = (jobs.data ?? []).filter((job) => job.application_count === 0);
    const all: SearchOption[] = [
      ...apps.map((row) => ({ value: `a:${row.id}`, label: row.label, hint: `${row.company_name} · ${statusStyle(row.status).text}`, group: tr('ui.emails.applications') })),
      ...standalone.map((job) => ({ value: `j:${job.id}`, label: job.title, hint: job.company_name, group: tr('ui.emails.jobsOnly') })),
    ];
    const suggested = all.filter((option) => reasons.has(option.value)).map((option) => ({ ...option, group: tr('ui.emails.suggested'), mark: tr(`ui.emails.reason.${reasons.get(option.value)}`) }));
    return [...suggested, ...all.filter((option) => !reasons.has(option.value))];
  });
  const targetLabel = $derived(options.find((option) => option.value === target)?.label ?? '');
  const ready = $derived(target !== '' && target !== current);

  async function save(): Promise<void> {
    if (!ready) return;
    const id = target.slice(2);
    await api.relinkEmail(email.id, target.startsWith('a:') ? { applicationId: id } : { jobId: id });
    toast.success(tr('ui.emails.relinked', { target: targetLabel }));
    invalidate();
    onclose();
  }
</script>

<Dialog open={true} title={tr('ui.emails.relinkTitle')} {onclose} ui="email-relink">
  <div class="stack">
    <SearchSelect
      label={tr('ui.emails.belongsTo')}
      ui="email-relink.target"
      {options}
      value={target}
      onchange={(next) => (target = next)}
      placeholder={applications.status === 'loading' || jobs.status === 'loading' ? tr('ui.emails.loadingTargets') : tr('ui.emails.targetPlaceholder')}
      emptyText={tr('ui.emails.targetEmpty')}
    />
    <p class="warn small" data-ui="email-relink.warning">{tr('ui.emails.relinkWarn', { from })}</p>
  </div>
  {#snippet footer()}
    <Button ui="email-relink.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button ui="email-relink.save" variant="primary" disabled={!ready} onclick={save}>{tr('ui.emails.relinkConfirm')}</Button>
  {/snippet}
</Dialog>

<style>
  .warn { margin: 0; padding: var(--space-2) var(--space-3); background: var(--warning-soft); border: 1px solid var(--warning); border-radius: var(--radius-m); }
</style>
