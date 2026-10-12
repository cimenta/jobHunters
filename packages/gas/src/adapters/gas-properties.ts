import type { KeyValueStore } from '@jobhunters/core';

/** Script properties as a key-value store; the scheduler keeps its "last run" marks here. */
export class GasPropertyStore implements KeyValueStore {
  constructor(private readonly properties: GoogleAppsScript.Properties.Properties) {}

  getAll(): Record<string, string> {
    return this.properties.getProperties();
  }

  set(key: string, value: string): void {
    this.properties.setProperty(key, value);
  }
}
