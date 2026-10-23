<script lang="ts">
  import type { CalendarInterview, CalendarWaiting } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { calendarColorStyle } from '../lib/calendar-colors';
  import { buildMonth, formatTime, shiftMonth, todayKey } from '../lib/calendar';
  import { channelIcon } from '../lib/entry-style';
  import { tr, ui } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { invalidate } from '../state/invalidate.svelte';
  import { uiState } from '../state/ui-state';

  const calendar = useResource(() => api.getCalendar());
  const today = todayKey();
  let month = $state(today.slice(0, 7));

  const weeks = $derived(buildMonth(month, calendar.data?.interviews ?? [], calendar.data?.waitings ?? [], today));
  const title = $derived(new Date(`${month}-01T00:00:00Z`).toLocaleDateString(ui.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  /** Monday first: 2026-10-05 is a Monday. */
  const weekdays = $derived(
    Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 5 + index)).toLocaleDateString(ui.locale, { weekday: 'short', timeZone: 'UTC' })),
  );

  const colors = $derived(calendarColorStyle(uiState().calendar_colors));

  const LANE = 22;

  const name = (item: { company_name: string; job_title: string }): string => [item.company_name, item.job_title].filter((part) => part !== '').join(' – ');
  const interviewHref = (item: CalendarInterview): string => (item.application_id !== '' ? paths.application(item.application_id) : paths.job(item.job_id));
  const interviewTip = (item: CalendarInterview): string => [formatTime(item.datetime), name(item), item.summary].filter((part) => part !== '').join(' · ');
  const waitingTip = (item: CalendarWaiting, late: boolean): string => `${tr(late ? 'ui.calendar.waitingLate' : 'ui.calendar.waiting')}: ${name(item)}`;
</script>

<div class="stack" data-ui="calendar" style={colors}>
  <div class="page-title">
    <h1 data-ui="calendar.title">{title}</h1>
    <div class="row wrap controls">
      <Button ui="calendar.prev" label={tr('ui.calendar.prev')} onclick={() => (month = shiftMonth(month, -1))}><Icon name="back" size={18} /></Button>
      <Button ui="calendar.today" onclick={() => (month = today.slice(0, 7))}>{tr('ui.calendar.today')}</Button>
      <Button ui="calendar.next" label={tr('ui.calendar.next')} onclick={() => (month = shiftMonth(month, 1))}><span class="flip"><Icon name="back" size={18} /></span></Button>
      <Button variant="ghost" ui="calendar.refresh" onclick={invalidate}><Icon name="refresh" size={18} />{tr('ui.match.refresh')}</Button>
    </div>
  </div>
  <div class="legend muted small" data-ui="calendar.legend">
    <span><i class="key interview"></i>{tr('ui.calendar.interview')}</span>
    <span><i class="key waiting"></i>{tr('ui.calendar.waiting')}</span>
    <span><i class="key late"></i>{tr('ui.calendar.waitingLate')}</span>
  </div>

  {#if calendar.status === 'loading'}
    <Skeleton lines={8} />
  {:else if calendar.status === 'error'}
    <ErrorBlock error={calendar.error} onretry={invalidate} />
  {:else}
    <div class="scroll">
      <div class="grid" data-ui="calendar.grid">
        <div class="dow">
          {#each weekdays as weekday (weekday)}<div>{weekday}</div>{/each}
        </div>
        {#each weeks as week (week.days[0]!.date)}
          <div class="week" data-ui="calendar.week.{week.days[0]!.date}">
            <div class="days">
              {#each week.days as day (day.date)}
                <div class="day" class:out={!day.inMonth} class:today={day.today} data-ui="calendar.day.{day.date}">
                  <div class="num">{#if day.today}<span>{day.number}</span>{:else}{day.number}{/if}</div>
                  <div style="height: {week.lanes * LANE}px"></div>
                  {#each day.interviews as item (item.id)}
                    <a class="chip" class:past={day.date < today} data-ui="calendar.interview.{item.id}" href={interviewHref(item)} title={interviewTip(item)}>
                      <Icon name={channelIcon(item.channel)} size={14} /><b>{formatTime(item.datetime)}</b><span class="what">{item.company_name || item.job_title}</span>
                    </a>
                  {/each}
                </div>
              {/each}
            </div>
            <div class="bars">
              {#each week.bars as bar (bar.waiting.application_id)}
                <a
                  class="wbar"
                  class:late={bar.late}
                  class:cl={bar.cutLeft}
                  class:cr={bar.cutRight}
                  data-ui="calendar.waiting.{bar.waiting.application_id}.{week.days[0]!.date}"
                  href={paths.application(bar.waiting.application_id)}
                  title={waitingTip(bar.waiting, bar.late)}
                  style="grid-column: {bar.from} / {bar.to}; grid-row: {bar.lane + 1}"
                >
                  <Icon name={bar.dueHere ? 'bell' : 'clock'} size={14} /><span class="what">{name(bar.waiting)}</span>
                </a>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .controls { align-items: center; }
  .flip { display: inline-flex; transform: scaleX(-1); }
  .legend { display: flex; gap: var(--space-4); flex-wrap: wrap; }
  .key { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: var(--space-1); vertical-align: -1px; }
  .key.interview { background: var(--cal-interview, var(--accent-soft)); }
  .key.waiting { background: var(--cal-waiting, var(--warning-soft)); }
  .key.late { background: var(--cal-late, var(--danger-soft)); }
  .scroll { overflow-x: auto; }
  .grid { min-width: 720px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); overflow: hidden; }
  .dow, .days, .bars { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .dow div { padding: var(--space-1) var(--space-2); font-size: var(--text-s); color: var(--text-muted); border-bottom: 1px solid var(--border); }
  .week { position: relative; border-bottom: 1px solid var(--border); }
  .week:last-child { border-bottom: 0; }
  .day { min-height: 120px; padding: 4px 6px 6px; border-right: 1px solid var(--border); box-sizing: border-box; min-width: 0; }
  .day:nth-child(7) { border-right: 0; }
  .day.out { background: var(--surface-2); color: var(--text-muted); }
  .num { font-size: var(--text-s); height: 20px; display: flex; align-items: center; }
  .day.today .num span { background: var(--accent); color: var(--on-accent); border-radius: 10px; padding: 0 7px; font-weight: 600; }
  .bars { position: absolute; left: 0; right: 0; top: 28px; pointer-events: none; grid-auto-rows: 20px; row-gap: 2px; }
  .wbar { pointer-events: auto; margin: 0 3px; padding: 0 8px; font-size: 0.75rem; line-height: 20px; border-radius: var(--radius-s); background: var(--cal-waiting, var(--warning-soft)); color: var(--cal-waiting-ink, var(--warning)); display: flex; align-items: center; gap: 4px; min-width: 0; text-decoration: none; }
  .wbar.late { background: var(--cal-late, var(--danger-soft)); color: var(--cal-late-ink, var(--danger)); }
  .wbar.cl { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: 0; }
  .wbar.cr { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: 0; }
  .chip { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; line-height: 18px; padding: 1px 6px; margin-top: 2px; border-radius: var(--radius-s); background: var(--cal-interview, var(--accent-soft)); color: var(--cal-interview-ink, var(--text)); text-decoration: none; min-width: 0; }
  .chip.past { opacity: 0.6; }
  .chip:hover, .wbar:hover { filter: brightness(0.95); }
  .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
