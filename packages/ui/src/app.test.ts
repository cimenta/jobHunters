import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from './App.svelte';
import { setTransport } from './api/client';
import { navigate } from './lib/router.svelte';
import { useDevBackend } from './test/transport';

describe('startup', () => {
  it('shows the loading state first and the navigation when the app is ready', async () => {
    useDevBackend();
    render(App);
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
    for (const name of ['Dashboard', 'Jobs', 'Applications', 'Companies', 'Calendar', 'Emails', 'Settings']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('shows a translated error with "Try again" when the server cannot be reached, then recovers', async () => {
    setTransport(async () => {
      throw new Error('network down');
    });
    render(App);
    expect(await screen.findByRole('alert')).toHaveTextContent('did not answer');
    expect(screen.queryByRole('navigation')).toBeNull();
    useDevBackend();
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('shows the setup hint when the backend has not been set up', async () => {
    setTransport(async () => ({ ok: false, error: { code: 'setup_required', params: {}, message: 'Run setup() first' } }));
    render(App);
    expect(await screen.findByRole('alert')).toHaveTextContent('Setup has not been run yet');
  });

  it('marks the current section in the navigation', async () => {
    useDevBackend();
    render(App);
    await screen.findByRole('navigation');
    navigate('#/jobs');
    expect(await screen.findByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('shows a page for unknown addresses that leads back to the dashboard', async () => {
    useDevBackend();
    render(App);
    await screen.findByRole('navigation');
    navigate('#/nope');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '#/');
  });
});
