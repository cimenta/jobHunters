import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './App.svelte';
import { setTransport } from './api/client';
import { gasTransport, hasGoogle } from './api/gas';

async function start(): Promise<void> {
  if (!hasGoogle() && import.meta.env.DEV) {
    // Development in a plain browser: the real handlers over in-memory data. This branch is removed from the production build.
    const { fakeTransport } = await import('./api/fake');
    setTransport(fakeTransport);
  } else {
    setTransport(gasTransport);
  }
  mount(App, { target: document.getElementById('app')! });
}

void start();
