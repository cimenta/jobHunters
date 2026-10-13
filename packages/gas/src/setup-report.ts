/** What a run of setup() reports to the web app: every log line and the verdict. */
export interface SetupResult {
  ok: boolean;
  lines: string[];
}

/** Whether setup() has to be run: what is missing, so the web app can show a red mark and name the reasons. */
export interface SetupStatus {
  needed: boolean;
  reasons: string[];
}

/** What setup() did to one sheet. */
export interface SheetChange {
  created: boolean;
  columns: number;
  seedRows: number;
  addedColumns: string[];
  /** Rows added to an existing key/value sheet (the Profile keys of a newer version). */
  addedRows?: string[];
  /** Keys of Profile values that an older version had stored as "=+420..." and that were given back their original text. */
  repairedValues?: string[];
}

export function describeSheetChange(name: string, change: SheetChange): string {
  if (change.created) {
    const rows = change.seedRows > 0 ? ` and ${change.seedRows} default rows` : '';
    return `Sheet ${name}: created with ${change.columns} columns${rows}`;
  }
  const parts: string[] = [];
  if (change.addedColumns.length > 0) parts.push(`added columns ${change.addedColumns.join(', ')}`);
  if (change.addedRows !== undefined && change.addedRows.length > 0) parts.push(`added rows ${change.addedRows.join(', ')}`);
  if (change.repairedValues !== undefined && change.repairedValues.length > 0) parts.push(`repaired values ${change.repairedValues.join(', ')}`);
  return parts.length > 0 ? `Sheet ${name}: existing, ${parts.join('; ')}` : `Sheet ${name}: existing, nothing to add`;
}

/**
 * Runs the steps of setup() and writes what each one did through `write`. It ends with "Setup finished: OK" or
 * "Setup finished: NOT OK" (after naming the reason) and returns "OK" or "NOT OK: <reason>"; it never throws,
 * so the log always shows how far setup got.
 */
export function reportSetup(write: (line: string) => void, steps: (say: (line: string) => void) => void): string {
  const say = (line: string): void => {
    try {
      write(line);
    } catch {
      // A broken log must not stop the setup itself.
    }
  };
  say('Setup started');
  try {
    steps(say);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    say(`Setup failed: ${reason}`);
    say('Setup finished: NOT OK');
    return `NOT OK: ${reason}`;
  }
  say('Setup finished: OK');
  return 'OK';
}
