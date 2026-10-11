import type { AppWarning, Settings, UiTheme } from '@jobhunters/core';
import { api } from '../api';
import { setLocale } from '../lib/i18n.svelte';

export const app = $state<{
  phase: 'loading' | 'ready' | 'error';
  error: unknown;
  version: string;
  settings: Settings | undefined;
  warnings: AppWarning[];
}>({ phase: 'loading', error: undefined, version: '', settings: undefined, warnings: [] });

/** 'system' leaves the choice to the device (prefers-color-scheme), the others force it. */
export function applyTheme(theme: UiTheme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Startup: version and settings (language, status labels). The screens render only after this succeeded. */
export async function loadApp(): Promise<void> {
  app.phase = 'loading';
  app.error = undefined;
  try {
    const [info, loaded] = await Promise.all([api.getAppInfo(), api.getSettings()]);
    app.version = info.version;
    app.settings = loaded.settings;
    app.warnings = loaded.warnings;
    setLocale(loaded.settings.ui_language);
    applyTheme(loaded.settings.ui_theme);
    app.phase = 'ready';
  } catch (error) {
    app.error = error;
    app.phase = 'error';
  }
}

/** After the user changed a setting: refresh language and status labels without a full restart. */
export async function reloadSettings(): Promise<void> {
  const loaded = await api.getSettings();
  app.settings = loaded.settings;
  app.warnings = loaded.warnings;
  setLocale(loaded.settings.ui_language);
  applyTheme(loaded.settings.ui_theme);
}
