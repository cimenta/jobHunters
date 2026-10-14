import { describe, expect, it } from 'vitest';
import { emptyParsedJob, finishParsedJob } from './parsed-job';
import { workModeFlags } from './work-mode';

describe('workModeFlags', () => {
  it('turns the old remote cell into the two checkboxes', () => {
    expect(workModeFlags('yes')).toEqual({ is_remote: true, is_hybrid: false });
    expect(workModeFlags('hybrid')).toEqual({ is_remote: false, is_hybrid: true });
    expect(workModeFlags(' Hybrid ')).toEqual({ is_remote: false, is_hybrid: true });
    expect(workModeFlags('no')).toEqual({ is_remote: false, is_hybrid: false });
    expect(workModeFlags('')).toEqual({ is_remote: false, is_hybrid: false });
  });
});

describe('finishParsedJob work mode', () => {
  it('ticks the checkboxes from what a portal parser found in `remote`', () => {
    expect(finishParsedJob({ ...emptyParsedJob(), remote: 'yes' })).toMatchObject({ is_remote: true, is_hybrid: false });
    expect(finishParsedJob({ ...emptyParsedJob(), remote: 'hybrid' })).toMatchObject({ is_remote: false, is_hybrid: true });
    expect(finishParsedJob({ ...emptyParsedJob(), remote: 'no' })).toMatchObject({ is_remote: false, is_hybrid: false });
  });
});
