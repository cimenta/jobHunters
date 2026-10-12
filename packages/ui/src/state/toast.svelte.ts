import { app } from './app.svelte';

export interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'warning';
  text: string;
}

export const toasts = $state<ToastItem[]>([]);
let nextId = 1;

export function dismissToast(id: number): void {
  const index = toasts.findIndex((item) => item.id === id);
  if (index >= 0) toasts.splice(index, 1);
}

function push(kind: ToastItem['kind'], text: string, lifetime: number): void {
  if (app.settings?.result_notices === false) return;
  const id = nextId++;
  toasts.push({ id, kind, text });
  if (typeof setTimeout !== 'undefined') setTimeout(() => dismissToast(id), lifetime);
}

export const toast = {
  success: (text: string) => push('success', text, 4000),
  error: (text: string) => push('error', text, 8000),
  warning: (text: string) => push('warning', text, 8000),
};
