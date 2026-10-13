import { PROMPTS_VERSION, type AppWarning, type Settings, type UiTheme } from '@jobhunters/core';
import { api } from '../api';
import { setLocale } from '../lib/i18n.svelte';

export const app = $state<{
  phase: 'loading' | 'ready' | 'error';
  error: unknown;
  version: string;
  /** Time zone of the script; times are shown in it. Empty = the browser's. */
  timeZone: string;
  settings: Settings | undefined;
  warnings: AppWarning[];
  /** Setup has something left to create (the red mark in the menu and on the Setup card), and why. */
  setupNeeded: boolean;
  setupReasons: string[];
}>({ phase: 'loading', error: undefined, version: '', timeZone: '', settings: undefined, warnings: [], setupNeeded: false, setupReasons: [] });

/** Asks the server whether setup is needed. A failed question leaves the mark off: it must never block the app. */
export async function reloadSetupStatus(): Promise<void> {
  try {
    const status = await api.getSetupStatus();
    app.setupNeeded = status.needed;
    app.setupReasons = status.reasons;
  } catch {
    app.setupNeeded = false;
    app.setupReasons = [];
  }
}

/** The built-in AI prompts changed since the user last took them over (or chose to keep their own). */
export function promptsOutdated(): boolean {
  return app.settings !== undefined && app.settings.ai_prompts_version !== String(PROMPTS_VERSION);
}

/** Something in Settings needs the user: setup has to be run, or the prompts are outdated. */
export function settingsNeedAttention(): boolean {
  return app.setupNeeded || promptsOutdated();
}

/** 'system' leaves the choice to the device (prefers-color-scheme), the others force it. */
export function applyTheme(theme: UiTheme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Startup: version and settings (language, status labels). The screens render only after this succeeded. */
export async function loadApp(): Promise<void> {
  app.phase = 'loading';
  app.error = undefined;
  // The check is slow on the server; it starts with the other startup calls and the mark appears when it answers.
  void reloadSetupStatus();
  try {
    const [info, loaded] = await Promise.all([api.getAppInfo(), api.getSettings()]);
    app.version = info.version;
    app.timeZone = info.timeZone;
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
