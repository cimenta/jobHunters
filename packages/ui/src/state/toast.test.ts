import { afterEach, describe, expect, it } from 'vitest';
import { app } from './app.svelte';
import { dismissToast, toast, toasts } from './toast.svelte';

afterEach(() => {
  app.settings = undefined;
  for (const item of [...toasts]) dismissToast(item.id);
});

const withSetting = (value: boolean): void => {
  app.settings = { result_notices: value } as typeof app.settings;
};

describe('toast', () => {
  it('shows notices by default and when the setting is on', () => {
    toast.success('a');
    withSetting(true);
    toast.error('b');
    expect(toasts.map((item) => item.text)).toEqual(['a', 'b']);
  });

  it('shows nothing of any kind when the setting is off', () => {
    withSetting(false);
    toast.success('a');
    toast.warning('b');
    toast.error('c');
    expect(toasts).toHaveLength(0);
  });
});
