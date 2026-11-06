import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import AddJob from './AddJob.svelte';
import Settings from './Settings.svelte';

// Invented data only.

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const input = (name: string) => ui(name) as HTMLInputElement | HTMLTextAreaElement;

async function openParserTab(): Promise<void> {
  await loadApp();
  render(Settings);
  await screen.findByRole('heading', { name: 'Settings' });
  await fireEvent.click(screen.getByRole('tab', { name: 'Parser' }));
}

async function openBlockedAd(): Promise<void> {
  await loadApp();
  render(AddJob);
  await fireEvent.input(input('add-job.url'), { target: { value: 'https://blocked.example/job/1' } });
  await fireEvent.click(ui('add-job.read')!);
  await waitFor(() => expect(ui('add-job.custom-load')).not.toBeNull());
}

describe('Settings, tab Parser', () => {
  it('shows the example request, keeps the key in a password field, has no Custom URL and saves the three values', async () => {
    useDevBackend();
    await openParserTab();
    expect(input('settings.parser.params').value).toContain("'url': 'https://parser.example.com/load?url=%%urlencoded%%&token=%%apikey%%'");
    expect(input('settings.parser.apikey')).toHaveAttribute('type', 'password');
    expect(ui('settings.parser.custom-url')).toBeNull();
    await fireEvent.input(input('settings.parser.name'), { target: { value: ' Acme parser ' } });
    await fireEvent.input(input('settings.parser.params'), { target: { value: "{'url': 'https://p.example.com/?u=%%urlencoded%%'}" } });
    await fireEvent.input(input('settings.parser.apikey'), { target: { value: 'key-1' } });
    await fireEvent.click(ui('settings.parser.save')!);
    await waitFor(async () => expect((await api.getSettings()).settings.parser_apikey).toBe('key-1'));
    const saved = (await api.getSettings()).settings;
    expect(saved.parser_name).toBe('Acme parser');
    expect(saved.parser_params).toBe("{'url': 'https://p.example.com/?u=%%urlencoded%%'}");
  });

  it('refuses a request that cannot be read, says why and saves nothing', async () => {
    useDevBackend();
    await openParserTab();
    await fireEvent.input(input('settings.parser.params'), { target: { value: "{'method': 'post', 'url': 'https://p.example.com'}" } });
    await fireEvent.click(ui('settings.parser.save')!);
    expect(await screen.findByText(/only the method get is supported/)).toBeInTheDocument();
    expect((await api.getSettings()).settings.parser_params).toContain('parser.example.com/load');
  });
});

describe('Add job, Custom load', () => {
  it('puts the answer of the parser into the text box', async () => {
    useDevBackend();
    await openBlockedAd();
    expect(ui('add-job.load-jina')).not.toBeNull();
    expect(ui('add-job.custom-load')).toHaveTextContent('Custom load');
    await fireEvent.click(ui('add-job.custom-load')!);
    await waitFor(() => expect(input('add-job.text').value).toBe('<html><body>Parsed by the demo parser: https://blocked.example/job/1</body></html>'));
  });

  it('names the button after the parser when Settings gives a name', async () => {
    useDevBackend();
    await loadApp();
    await api.updateSettings({ parser_name: 'Acme parser' });
    await openBlockedAd();
    expect(ui('add-job.custom-load')).toHaveTextContent('Load with Acme parser');
  });

  it('opens a window with the reason, the request and the response when the parser does not answer properly', async () => {
    useDevBackend();
    await loadApp();
    await api.updateSettings({ parser_params: "{'url': 'https://other.example.com/?t=%%apikey%%', 'headers': {'X-Key': '%%apikey%%'}}", parser_apikey: 'secret-key' });
    await openBlockedAd();
    await fireEvent.click(ui('add-job.custom-load')!);
    await waitFor(() => expect(ui('custom-load-failure')).not.toBeNull());
    expect(ui('custom-load-failure.reason')).toHaveTextContent('The parser did not answer properly (HTTP 404).');
    expect(ui('custom-load-failure.request')).toHaveTextContent('GET https://other.example.com/?t=•••');
    expect(ui('custom-load-failure.request')).toHaveTextContent('X-Key: •••');
    expect(ui('custom-load-failure')).not.toHaveTextContent('secret-key');
    expect(ui('custom-load-failure.response')).toHaveTextContent('HTTP 404');
    expect(input('add-job.text').value).toBe('');
    await fireEvent.click(ui('custom-load-failure.close')!);
    await waitFor(() => expect(ui('custom-load-failure')).toBeNull());
    expect(ui('add-job.custom-load')).not.toBeDisabled();
  });

  it('copies the request and the response from that window', async () => {
    useDevBackend();
    await loadApp();
    await api.updateSettings({ parser_params: "{'url': 'https://other.example.com/'}" });
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => void written.push(text) }, configurable: true });
    await openBlockedAd();
    await fireEvent.click(ui('add-job.custom-load')!);
    await waitFor(() => expect(ui('custom-load-failure.copy')).not.toBeNull());
    await fireEvent.click(ui('custom-load-failure.copy')!);
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toContain('Request\nGET https://other.example.com/');
    expect(written[0]).toContain('Response\nHTTP 404');
  });

  it('keeps a short message when the request cannot be built, as nothing was sent', async () => {
    useDevBackend();
    await loadApp();
    await api.updateSettings({ parser_params: 'oops' });
    await openBlockedAd();
    await fireEvent.click(ui('add-job.custom-load')!);
    await waitFor(() => expect(toasts.some((t) => t.text.startsWith('The request in Settings, tab Parser, is not valid'))).toBe(true));
    expect(ui('custom-load-failure')).toBeNull();
  });
});
