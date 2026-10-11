import { DuplicateIdError, NotFoundError, ValidationError } from './errors';

export interface Repository<T extends { id: string }> {
  list(): T[];
  get(id: string): T | undefined;
  insert(item: T): T;
  update(id: string, patch: Partial<Omit<T, 'id'>>): T;
  remove(id: string): void;
}

export interface AppendLog<T> {
  append(entry: T): void;
  list(): T[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly items = new Map<string, T>();

  constructor(initial: readonly T[] = []) {
    for (const item of initial) this.insert(item);
  }

  list(): T[] {
    return [...this.items.values()].map(copy);
  }

  get(id: string): T | undefined {
    const found = this.items.get(id);
    return found === undefined ? undefined : copy(found);
  }

  insert(item: T): T {
    if (!item.id) throw new ValidationError('A row needs a non-empty id');
    if (this.items.has(item.id)) throw new DuplicateIdError(`Row ${item.id} already exists`);
    this.items.set(item.id, copy(item));
    return copy(item);
  }

  update(id: string, patch: Partial<Omit<T, 'id'>>): T {
    const current = this.items.get(id);
    if (current === undefined) throw new NotFoundError(`Row ${id} not found`);
    const next = { ...current, ...patch, id } as T;
    this.items.set(id, copy(next));
    return copy(next);
  }

  remove(id: string): void {
    if (!this.items.delete(id)) throw new NotFoundError(`Row ${id} not found`);
  }
}

export class InMemoryAppendLog<T> implements AppendLog<T> {
  private readonly entries: T[] = [];

  append(entry: T): void {
    this.entries.push(copy(entry));
  }

  list(): T[] {
    return this.entries.map(copy);
  }
}
