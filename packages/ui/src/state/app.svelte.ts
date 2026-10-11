import type { AppWarning, Settings } from '@jobhunters/core';
import { api } from '../api';
import { setLocale } from '../lib/i18n.svelte';

export const app = $state<{
  phase: 'loading' | 'ready' | 'error';
  error: unknown;
  version: string;
  settings: Settings | undefined;
  warnings: AppWarning[];
}>({ phase: 'loading', error: undefined, version: '', settings: undefined, warnings: [] });

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
}
