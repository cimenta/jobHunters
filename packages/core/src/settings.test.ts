import { describe, expect, it } from 'vitest';
import { InMemoryKeyValueStore } from './key-value';
import type { Lock } from './lock';
import { errorOf } from './testing/errors';
import { parseSettings, SettingsService } from './settings';

describe('parseSettings', () => {
  it('returns the defaults for an empty sheet', () => {
    const { settings, warnings } = parseSettings({});
    expect(settings).toMatchObject({
      ui_language: 'en',
      default_document_language: 'en',
      reminder_time: '08:00',
      reminder_email: '',
      availability_check_days: 1,
      default_document_set: ['resume', 'cover_letter'],
    });
    expect(settings.offline_texts.length).toBeGreaterThan(0);
    expect(warnings).toEqual([]);
  });

  it('parses stored values', () => {
    const { settings } = parseSettings({
      ui_language: 'cs',
      availability_check_days: '7',
      offline_texts: 'gone\n\n  closed  \n',
      pdf_service_order: 'a, b ,',
      reminder_email: 'you@example.invalid',
    });
    expect(settings).toMatchObject({
      ui_language: 'cs',
      availability_check_days: 7,
      offline_texts: ['gone', 'closed'],
      pdf_service_order: ['a', 'b'],
      reminder_email: 'you@example.invalid',
    });
  });

  it('has an empty status_styles setting by default and parses stored styles', () => {
    expect(parseSettings({}).settings.status_styles).toEqual({});
    const { settings, warnings } = parseSettings({ status_styles: '{"sent":{"color":"#2563eb"}}' });
    expect(settings.status_styles).toEqual({ sent: { color: '#2563eb' } });
    expect(warnings).toEqual([]);
  });

  it('falls back to the defaults and warns for invalid status_styles', () => {
    const { settings, warnings } = parseSettings({ status_styles: '{"sent":{"color":"blue"}}' });
    expect(settings.status_styles).toEqual({});
    expect(warnings).toEqual([{ code: 'setting_invalid', params: { key: 'status_styles', value: '{"sent":{"color":"blue"}}' } }]);
  });

  it('falls back to the default and warns on an invalid value', () => {
    const { settings, warnings } = parseSettings({ reminder_time: '25:00', ui_language: 'de', availability_check_days: '0' });
    expect(settings.reminder_time).toBe('08:00');
    expect(settings.ui_language).toBe('en');
    expect(settings.availability_check_days).toBe(1);
    expect(warnings).toEqual([
      { code: 'setting_invalid', params: { key: 'ui_language', value: 'de' } },
      { code: 'setting_invalid', params: { key: 'reminder_time', value: '25:00' } },
      { code: 'setting_invalid', params: { key: 'availability_check_days', value: '0' } },
    ]);
  });
});

describe('SettingsService', () => {
  it('persists a valid update and returns the parsed settings', () => {
    const service = new SettingsService(new InMemoryKeyValueStore());
    expect(service.update({ ui_language: 'cs' }).ui_language).toBe('cs');
    expect(service.get().settings.ui_language).toBe('cs');
  });

  it('stores the colour mode and rejects an unknown one', () => {
    const service = new SettingsService(new InMemoryKeyValueStore());
    expect(service.get().settings.ui_theme).toBe('system');
    expect(service.update({ ui_theme: 'dark' }).ui_theme).toBe('dark');
    expect(() => service.update({ ui_theme: 'blue' })).toThrow();
  });

  it('validates everything before writing anything', () => {
    const store = new InMemoryKeyValueStore();
    const service = new SettingsService(store);
    const error = errorOf(() => service.update({ ui_language: 'cs', reminder_time: 'nope' }));
    expect(error).toMatchObject({ code: 'settings_invalid', params: { key: 'reminder_time', value: 'nope' } });
    expect(store.getAll()).toEqual({});
  });

  it('rejects unknown keys', () => {
    const error = errorOf(() => new SettingsService(new InMemoryKeyValueStore()).update({ api_key: 'secret' }));
    expect(error).toMatchObject({ code: 'settings_unknown_key', params: { key: 'api_key' } });
  });

  it('writes inside the lock', () => {
    let runs = 0;
    const lock: Lock = { run: (fn) => (runs++, fn()) };
    new SettingsService(new InMemoryKeyValueStore(), lock).update({ ui_language: 'cs' });
    expect(runs).toBe(1);
  });
});

describe('SettingsService status_styles', () => {
  it('stores valid styles and rejects invalid ones without writing', () => {
    const store = new InMemoryKeyValueStore();
    const service = new SettingsService(store);
    expect(service.update({ status_styles: '{"offer":{"color":"#15803d"}}' }).status_styles).toEqual({ offer: { color: '#15803d' } });
    expect(errorOf(() => service.update({ status_styles: '{"offer":{"color":"green"}}' }))).toMatchObject({ code: 'settings_invalid', params: { key: 'status_styles' } });
    expect(store.getAll().status_styles).toBe('{"offer":{"color":"#15803d"}}');
  });
});
