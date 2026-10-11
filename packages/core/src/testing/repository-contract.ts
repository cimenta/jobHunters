import { describe, expect, it } from 'vitest';
import { DuplicateIdError, NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import type { Company } from '../types';

export const company = (overrides: Partial<Company> = {}): Company => ({ id: 'c1', name: 'Acme', website: '', notes: '', ...overrides });

export function describeRepositoryContract(name: string, create: () => Repository<Company>): void {
  describe(`${name} satisfies the Repository contract`, () => {
    it('inserts, gets and lists rows in insertion order', () => {
      const repo = create();
      repo.insert(company({ id: 'a' }));
      repo.insert(company({ id: 'b' }));
      expect(repo.get('a')?.id).toBe('a');
      expect(repo.list().map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('returns undefined for an unknown id', () => {
      expect(create().get('nope')).toBeUndefined();
    });

    it('rejects a duplicate and an empty id', () => {
      const repo = create();
      repo.insert(company({ id: 'a' }));
      expect(() => repo.insert(company({ id: 'a' }))).toThrow(DuplicateIdError);
      expect(() => repo.insert(company({ id: '' }))).toThrow(ValidationError);
    });

    it('updates with a patch', () => {
      const repo = create();
      repo.insert(company({ id: 'a' }));
      expect(repo.update('a', { name: 'Renamed' })).toEqual(company({ id: 'a', name: 'Renamed' }));
      expect(repo.get('a')?.name).toBe('Renamed');
    });

    it('throws NotFoundError when updating or removing an unknown id', () => {
      const repo = create();
      expect(() => repo.update('nope', { name: 'x' })).toThrow(NotFoundError);
      expect(() => repo.remove('nope')).toThrow(NotFoundError);
    });

    it('finds rows by id after earlier rows were removed', () => {
      const repo = create();
      for (const id of ['a', 'b', 'c']) repo.insert(company({ id, name: id }));
      repo.remove('a');
      repo.update('c', { name: 'C2' });
      expect(repo.list().map((r) => `${r.id}:${r.name}`)).toEqual(['b:b', 'c:C2']);
    });

    it('hands out copies so callers cannot mutate stored rows', () => {
      const repo = create();
      repo.insert(company({ id: 'a' }));
      const fetched = repo.get('a')!;
      fetched.name = 'mutated';
      repo.list()[0]!.name = 'mutated too';
      expect(repo.get('a')?.name).toBe('Acme');
    });

    it('round-trips multi-line text, unicode and formula-looking text unchanged', () => {
      const repo = create();
      const notes = 'Šíleně žluťoučký\nkůň\n=SUM(1)';
      repo.insert(company({ id: 'a', notes }));
      expect(repo.get('a')?.notes).toBe(notes);
    });
  });
}
