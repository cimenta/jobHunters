import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_URL } from '@jobhunters/gas/dev';
import { api } from '../api';
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
    expect(await screen.findByText(/1 saved, 1 sent to the AI/)).toBeInTheDocument();
    expect(screen.getByText('Not a link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI tasks/ })).toHaveAttribute('href', '#/tasks');
    expect((await api.listAiTasks()).filter((t) => t.type === 'import_job')).toHaveLength(1);
  });

  it('reports an already saved link and keeps going', async () => {
    useDevBackend();
    render(BatchAdd, { pauseMs: 0 });
    await fireEvent.input(screen.getByLabelText('Links to the ads'), { target: { value: `${DEMO_URL}\n${DEMO_URL}/` } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(await screen.findByText(/1 saved, 0 sent to the AI/)).toBeInTheDocument();
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
    expect(await screen.findByText(/1 saved, 1 sent to the AI/, {}, { timeout: 4000 })).toBeInTheDocument();
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
    expect(await screen.findByText(/1 saved, 0 sent to the AI/)).toBeInTheDocument();
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
