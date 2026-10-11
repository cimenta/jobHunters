import { describe, expect, it } from 'vitest';
import { DuplicateIdError, NotFoundError, ValidationError } from './errors';
import { InMemoryAppendLog, InMemoryRepository } from './repository';

interface Row {
  id: string;
  name: string;
  tags: string[];
}

const row = (overrides: Partial<Row> = {}): Row => ({ id: 'x1', name: 'one', tags: [], ...overrides });

describe('InMemoryRepository', () => {
  it('inserts, gets and lists rows', () => {
    const repo = new InMemoryRepository<Row>();
    repo.insert(row({ id: 'a' }));
    repo.insert(row({ id: 'b' }));
    expect(repo.get('a')?.id).toBe('a');
    expect(repo.list().map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('returns undefined for an unknown id', () => {
    expect(new InMemoryRepository<Row>().get('nope')).toBeUndefined();
  });

  it('rejects a duplicate id', () => {
    const repo = new InMemoryRepository<Row>([row({ id: 'a' })]);
    expect(() => repo.insert(row({ id: 'a' }))).toThrow(DuplicateIdError);
  });

  it('rejects an empty id', () => {
    expect(() => new InMemoryRepository<Row>().insert(row({ id: '' }))).toThrow(ValidationError);
  });

  it('updates a row with a patch and keeps the id', () => {
    const repo = new InMemoryRepository<Row>([row({ id: 'a' })]);
    const updated = repo.update('a', { name: 'renamed' });
    expect(updated).toEqual({ id: 'a', name: 'renamed', tags: [] });
    expect(repo.get('a')?.name).toBe('renamed');
  });

  it('throws NotFoundError when updating or removing an unknown id', () => {
    const repo = new InMemoryRepository<Row>();
    expect(() => repo.update('nope', { name: 'x' })).toThrow(NotFoundError);
    expect(() => repo.remove('nope')).toThrow(NotFoundError);
  });

  it('removes a row', () => {
    const repo = new InMemoryRepository<Row>([row({ id: 'a' })]);
    repo.remove('a');
    expect(repo.list()).toEqual([]);
  });

  it('hands out copies so callers cannot mutate stored rows', () => {
    const repo = new InMemoryRepository<Row>([row({ id: 'a', tags: ['t'] })]);
    const fetched = repo.get('a')!;
    fetched.name = 'mutated';
    fetched.tags.push('extra');
    repo.list()[0]!.name = 'mutated too';
    expect(repo.get('a')).toEqual({ id: 'a', name: 'one', tags: ['t'] });
  });

  it('stores a copy of inserted rows', () => {
    const repo = new InMemoryRepository<Row>();
    const original = row({ id: 'a' });
    repo.insert(original);
    original.name = 'mutated after insert';
    expect(repo.get('a')?.name).toBe('one');
  });
});

describe('InMemoryAppendLog', () => {
  it('keeps entries in insertion order and returns copies', () => {
    const log = new InMemoryAppendLog<{ n: number }>();
    log.append({ n: 1 });
    log.append({ n: 2 });
    const entries = log.list();
    entries[0]!.n = 99;
    expect(log.list()).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
