export const DASHBOARD_WIDGETS = ['reminders', 'ai_tasks', 'status_counts'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];

/** Position and size in grid cells; the Dashboard grid has DASHBOARD_COLS columns. */
export interface WidgetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A widget missing from the layout is removed from the Dashboard. */
export type DashboardLayout = Partial<Record<DashboardWidgetId, WidgetBox>>;

export const DASHBOARD_COLS = 12;
export const WIDGET_MIN_W = 2;
export const WIDGET_MIN_H = 2;
const MAX_ROW = 200;

export const DEFAULT_DASHBOARD_LAYOUT: Readonly<Record<DashboardWidgetId, WidgetBox>> = {
  reminders: { x: 0, y: 0, w: 7, h: 9 },
  ai_tasks: { x: 7, y: 0, w: 5, h: 4 },
  status_counts: { x: 7, y: 4, w: 5, h: 5 },
};

export function isDashboardWidget(id: string): id is DashboardWidgetId {
  return (DASHBOARD_WIDGETS as readonly string[]).includes(id);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** A box inside the grid with at least the minimum size; wrongly shaped values are refused (undefined). */
function checkedBox(value: unknown): WidgetBox | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { x, y, w, h } = value as Record<string, unknown>;
  if (!isInt(x) || !isInt(y) || !isInt(w) || !isInt(h)) return undefined;
  if (w < WIDGET_MIN_W || h < WIDGET_MIN_H || x < 0 || y < 0 || x + w > DASHBOARD_COLS || y > MAX_ROW) return undefined;
  return { x, y, w, h };
}

/** Unknown widgets are dropped, a wrongly shaped value makes the whole layout invalid; overlaps are resolved. */
export function parseDashboardLayout(value: unknown): DashboardLayout | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const boxes: [DashboardWidgetId, WidgetBox][] = [];
  for (const [id, raw] of Object.entries(value)) {
    const box = checkedBox(raw);
    if (box === undefined) return undefined;
    if (isDashboardWidget(id)) boxes.push([id, box]);
  }
  return settle(Object.fromEntries(boxes) as DashboardLayout);
}

/** The layout to draw: the stored one, or the default when nothing was stored. */
export function effectiveLayout(stored: DashboardLayout | null | undefined): DashboardLayout {
  return stored ?? { ...DEFAULT_DASHBOARD_LAYOUT };
}

function overlaps(a: WidgetBox, b: WidgetBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function entries(layout: DashboardLayout): [DashboardWidgetId, WidgetBox][] {
  return (Object.entries(layout) as [DashboardWidgetId, WidgetBox][]).sort(([, a], [, b]) => a.y - b.y || a.x - b.x);
}

/** Pushes widgets that overlap an earlier one down below it. `first` (the widget being moved) keeps its place. */
function settle(layout: DashboardLayout, first?: DashboardWidgetId): DashboardLayout {
  const placed: WidgetBox[] = [];
  const out: DashboardLayout = {};
  const order = entries(layout);
  if (first !== undefined) order.sort(([a], [b]) => Number(b === first) - Number(a === first));
  for (const [id, box] of order) {
    const next = { ...box };
    for (let clash = placed.find((other) => overlaps(next, other)); clash; clash = placed.find((other) => overlaps(next, other))) {
      next.y = clash.y + clash.h;
    }
    placed.push(next);
    out[id] = next;
  }
  return out;
}

/** Keeps a box inside the grid and at least the minimum size. */
export function clampBox(box: WidgetBox): WidgetBox {
  const w = Math.min(DASHBOARD_COLS, Math.max(WIDGET_MIN_W, Math.round(box.w)));
  const h = Math.max(WIDGET_MIN_H, Math.round(box.h));
  const x = Math.min(DASHBOARD_COLS - w, Math.max(0, Math.round(box.x)));
  const y = Math.min(MAX_ROW, Math.max(0, Math.round(box.y)));
  return { x, y, w, h };
}

/** Places one widget at a box (moved or resized) and pushes the others out of its way. */
export function placeWidget(layout: DashboardLayout, id: DashboardWidgetId, box: WidgetBox): DashboardLayout {
  return settle({ ...layout, [id]: clampBox(box) }, id);
}

export function removeWidget(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  const { [id]: _removed, ...rest } = layout;
  return rest;
}

/** Adds a widget below everything else, at its default size. */
export function addWidget(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  const bottom = Math.max(0, ...Object.values(layout).map((box) => box.y + box.h));
  const size = DEFAULT_DASHBOARD_LAYOUT[id];
  return { ...layout, [id]: { x: 0, y: bottom, w: size.w, h: size.h } };
}

/** Widgets in reading order (top to bottom, left to right); the order of the stacked narrow-screen view. */
export function widgetOrder(layout: DashboardLayout): DashboardWidgetId[] {
  return entries(layout).map(([id]) => id);
}
