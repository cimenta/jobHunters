import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_URL } from '@jobhunters/gas/dev';
import { api } from '../api';
import { navigate, router } from '../lib/router.svelte';
import { useDevBackend } from '../test/transport';
import BatchAdd from './BatchAdd.svelte';
import AddJob from './AddJob.svelte';

describe('BatchAdd', () => {
  it('adds several links, shows each result and a summary, and queues the unreadable one', async () => {
    useDevBackend();
    render(AddJob);
    await fireEvent.click(screen.getByRole('tab', { name: 'Several links' }));
    await fireEvent.input(screen.getByLabelText('Links to the ads'), {
      target: { value: `${DEMO_URL}\nhttps://blocked.example/job/1\nnot a link` },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(await screen.findByText('Done: 1 saved, 1 sent to the AI, 1 not links')).toBeInTheDocument();
    expect(screen.getByText('Not a link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI tasks/ })).toHaveAttribute('href', '#/tasks');
    expect((await api.listAiTasks()).filter((t) => t.type === 'import_job')).toHaveLength(1);
  });

  it('reports an already saved link and keeps going', async () => {
    useDevBackend();
    render(BatchAdd, { pauseMs: 0 });
    await fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value: `${DEMO_URL}\n${DEMO_URL}/` } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(await screen.findByText('Done: 1 saved, 1 already saved')).toBeInTheDocument();
  });
});

describe('BatchAdd robustness', () => {
  const type = async (value: string) => fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value } });

  it('keeps its state and a single run when the tab is switched during a batch', async () => {
    useDevBackend();
    const spy = vi.spyOn(api, 'importJob');
    render(AddJob);
    await fireEvent.click(screen.getByRole('tab', { name: 'Several links' }));
    await type(`${DEMO_URL}\nhttps://blocked.example/job/1`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await fireEvent.click(screen.getByRole('tab', { name: 'One link' }));
    await fireEvent.click(screen.getByRole('tab', { name: 'Several links' }));
    expect(await screen.findByText('Done: 1 saved, 1 sent to the AI', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Links to the ads')).toHaveValue(`${DEMO_URL}\nhttps://blocked.example/job/1`);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('stops after the current link and says how many were processed', async () => {
    useDevBackend();
    let release: (value: Awaited<ReturnType<typeof api.importJob>>) => void = () => {};
    const spy = vi.spyOn(api, 'importJob').mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );
    render(BatchAdd, { pauseMs: 0 });
    await type(['https://a.example/1', 'https://a.example/2', 'https://a.example/3'].join(String.fromCharCode(10)));
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    release({ status: 'saved', job: { id: 'j1', title: 'First job' }, company: undefined, warnings: [] } as never);
    expect(await screen.findByText('Stopped: 1 of 3 links processed.')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('shows a Failed row when a call throws and carries on', async () => {
    useDevBackend();
    const spy = vi.spyOn(api, 'importJob').mockRejectedValueOnce(new Error('boom'));
    render(BatchAdd, { pauseMs: 0 });
    await type(`https://blocked.example/1\n${DEMO_URL}`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(await screen.findByText('Done: 1 saved, 1 failed')).toBeInTheDocument();
    expect(screen.getByText(/Failed:/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('stops the loop when the component is destroyed', async () => {
    useDevBackend();
    const spy = vi.spyOn(api, 'importJob');
    const { unmount } = render(BatchAdd, { pauseMs: 50 });
    await type(`${DEMO_URL}
https://blocked.example/job/1`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('BatchAdd progress', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
  }
  const saved = (id: string, title: string) => ({ status: 'saved', job: { id, title }, fetchStatus: 200 }) as unknown as Awaited<ReturnType<typeof api.importJob>>;

  it('shows which ad is being processed, a progress bar and the link while the batch runs, and removes them when it ends', async () => {
    useDevBackend();
    const first = deferred<Awaited<ReturnType<typeof api.importJob>>>();
    const second = deferred<Awaited<ReturnType<typeof api.importJob>>>();
    const answers = [first, second];
    let call = 0;
    vi.spyOn(api, 'importJob').mockImplementation(() => answers[call++]!.promise);
    render(BatchAdd, { pauseMs: 0 });
    await fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value: 'https://a.example/1\nhttps://b.example/2' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));

    expect(await screen.findByText('Processing ad 1 of 2…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-ui', 'batch.progress');
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
    expect(document.querySelector('[data-ui="batch.progress.current"]')).toHaveTextContent('https://a.example/1');
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByText('Waiting for the answer of the page…')).toBeInTheDocument();

    first.resolve(saved('j1', 'Ad one'));
    expect(await screen.findByText('Processing ad 2 of 2…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(document.querySelector('[data-ui="batch.progress.current"]')).toHaveTextContent('https://b.example/2');
    expect(screen.getByText('Ad one')).toBeInTheDocument();

    second.resolve(saved('j2', 'Ad two'));
    expect(await screen.findByText('Done: all 2 ads are saved')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Waiting for the answer of the page…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add all' })).toBeEnabled();
    vi.restoreAllMocks();
  });

  it('stops showing progress when the user stops the batch', async () => {
    useDevBackend();
    const first = deferred<Awaited<ReturnType<typeof api.importJob>>>();
    vi.spyOn(api, 'importJob').mockImplementation(() => first.promise);
    render(BatchAdd, { pauseMs: 0 });
    await fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value: 'https://a.example/1\nhttps://b.example/2' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Processing ad 1 of 2…');
    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    first.resolve(saved('j1', 'Ad one'));
    expect(await screen.findByText(/1 saved/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('BatchAdd done', () => {
  const type = async (value: string) => fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value } });
  const done = () => document.querySelector('[data-ui="batch.done"]') as HTMLElement | null;

  it('presents a green done block with a Close button for the whole window when everything was saved', async () => {
    useDevBackend();
    const onclose = vi.fn();
    render(BatchAdd, { pauseMs: 0, onclose });
    await type(`${DEMO_URL}`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Done: the ad is saved');
    expect(done()).toHaveAttribute('role', 'status');
    expect(done()).toHaveAttribute('data-outcome', 'ok');
    await fireEvent.click(within(done()!).getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('warns in the done block when something was not saved, and offers the AI tasks for ads sent to the AI', async () => {
    useDevBackend();
    render(BatchAdd, { pauseMs: 0, onclose: () => {} });
    await type(`${DEMO_URL}\nhttps://blocked.example/job/1`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Done: 1 saved, 1 sent to the AI');
    expect(done()).toHaveAttribute('data-outcome', 'partly');
    expect(within(done()!).getByRole('link', { name: 'AI tasks' })).toHaveAttribute('href', '#/tasks');
  });

  it('says that the batch was stopped', async () => {
    useDevBackend();
    let release: (value: Awaited<ReturnType<typeof api.importJob>>) => void = () => {};
    vi.spyOn(api, 'importJob').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    render(BatchAdd, { pauseMs: 0, onclose: () => {} });
    await type('https://a.example/1\nhttps://a.example/2');
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    release({ status: 'saved', job: { id: 'j1', title: 'First' }, company: undefined, warnings: [] } as never);
    await screen.findByText('Stopped: 1 of 2 links processed.');
    expect(done()).toHaveAttribute('data-outcome', 'stopped');
    vi.restoreAllMocks();
  });

  it('clears the links and the block when the user adds more', async () => {
    useDevBackend();
    render(BatchAdd, { pauseMs: 0, onclose: () => {} });
    await type(`${DEMO_URL}`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Done: the ad is saved');
    await fireEvent.click(within(done()!).getByRole('button', { name: 'Add more' }));
    expect(done()).toBeNull();
    expect(screen.getByLabelText('Links to the ads')).toHaveValue('');
  });

  it('has no done block while the batch runs and no Close button when the window cannot be closed from here', async () => {
    useDevBackend();
    render(BatchAdd, { pauseMs: 0 });
    expect(done()).toBeNull();
    await type(`${DEMO_URL}`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Done: the ad is saved');
    expect(within(done()!).queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('closes the whole Add a job window from the done block', async () => {
    useDevBackend();
    navigate('#/jobs/new');
    render(AddJob);
    await fireEvent.click(screen.getByRole('tab', { name: 'Several links' }));
    await type(`${DEMO_URL}`);
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await screen.findByText('Done: the ad is saved');
    await fireEvent.click(within(done()!).getByRole('button', { name: 'Close' }));
    expect(router.current.name).toBe('jobs');
  });
});
