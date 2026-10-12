import { DEFAULT_UI_STATE, serializeUiState, type UiState } from '@jobhunters/core';
import { api } from '../api';
import { notifyError } from '../lib/notify';
import { app } from './app.svelte';

/** What the interface remembers, stored in the app (the setting ui_state), not in the browser. */
export function uiState(): UiState {
  return app.settings?.ui_state ?? DEFAULT_UI_STATE;
}

/** Applies a change at once and stores it in the background. */
export function saveUiState(patch: Partial<UiState>): void {
  const next = { ...uiState(), ...patch };
  if (app.settings) app.settings = { ...app.settings, ui_state: next };
  api.updateSettings({ ui_state: serializeUiState(next) }).catch(notifyError);
}
