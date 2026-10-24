import { describe, expect, it } from 'vitest';
import { addWidget, clampBox, DEFAULT_DASHBOARD_LAYOUT, effectiveLayout, parseDashboardLayout, placeWidget, removeWidget, widgetOrder } from './dashboard-layout';
import { parseUiState } from './ui-state';

describe('dashboard layout', () => {
  it('uses the default when nothing is stored', () => {
    expect(effectiveLayout(null)).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(parseUiState('{}')?.dashboard_layout).toBeNull();
  });

  it('parses a stored layout, drops unknown widgets and refuses wrong shapes', () => {
    const raw = { reminders: { x: 0, y: 0, w: 6, h: 4 }, nope: { x: 0, y: 0, w: 4, h: 4 } };
    expect(parseDashboardLayout(raw)).toEqual({ reminders: { x: 0, y: 0, w: 6, h: 4 } });
    expect(parseDashboardLayout({})).toEqual({});
    expect(parseDashboardLayout([])).toBeUndefined();
    expect(parseDashboardLayout({ reminders: { x: 0, y: 0, w: 1, h: 4 } })).toBeUndefined();
    expect(parseDashboardLayout({ reminders: { x: 10, y: 0, w: 6, h: 4 } })).toBeUndefined();
    expect(parseDashboardLayout({ reminders: { x: 0.5, y: 0, w: 6, h: 4 } })).toBeUndefined();
  });

  it('resolves overlaps of a stored layout by pushing widgets down', () => {
    const parsed = parseDashboardLayout({ reminders: { x: 0, y: 0, w: 6, h: 4 }, ai_tasks: { x: 3, y: 1, w: 6, h: 3 } });
    expect(parsed?.ai_tasks).toEqual({ x: 3, y: 4, w: 6, h: 3 });
  });

  it('is stored in and read from the ui state', () => {
    const state = parseUiState('{"dashboard_layout":{"ai_tasks":{"x":2,"y":1,"w":4,"h":3}}}');
    expect(state?.dashboard_layout).toEqual({ ai_tasks: { x: 2, y: 1, w: 4, h: 3 } });
    expect(parseUiState('{"dashboard_layout":{"ai_tasks":{"x":2}}}')).toBeUndefined();
    expect(parseUiState('{"dashboard_layout":null}')?.dashboard_layout).toBeNull();
  });

  it('clamps a box into the grid with the minimum size', () => {
    expect(clampBox({ x: -3, y: -1, w: 1, h: 0 })).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(clampBox({ x: 11, y: 2, w: 5, h: 3 })).toEqual({ x: 7, y: 2, w: 5, h: 3 });
  });

  it('moves a widget and pushes the ones in its way down', () => {
    const moved = placeWidget(effectiveLayout(null), 'ai_tasks', { x: 0, y: 0, w: 5, h: 4 });
    expect(moved.ai_tasks).toEqual({ x: 0, y: 0, w: 5, h: 4 });
    expect(moved.reminders).toEqual({ x: 0, y: 4, w: 7, h: 9 });
    expect(moved.status_counts).toEqual({ x: 7, y: 4, w: 5, h: 5 });
  });

  it('removes and adds widgets; an added one goes to the bottom', () => {
    const without = removeWidget(effectiveLayout(null), 'reminders');
    expect(Object.keys(without)).toEqual(['ai_tasks', 'status_counts']);
    const back = addWidget(without, 'reminders');
    expect(back.reminders).toEqual({ x: 0, y: 9, w: 7, h: 9 });
    expect(addWidget({}, 'ai_tasks').ai_tasks).toEqual({ x: 0, y: 0, w: 5, h: 4 });
  });

  it('lists widgets in reading order', () => {
    expect(widgetOrder(effectiveLayout(null))).toEqual(['reminders', 'ai_tasks', 'status_counts']);
  });
});
