/** What setup() did to one sheet. */
export interface SheetChange {
  created: boolean;
  columns: number;
  seedRows: number;
  addedColumns: string[];
}

export function describeSheetChange(name: string, change: SheetChange): string {
  if (change.created) {
    const rows = change.seedRows > 0 ? ` and ${change.seedRows} default rows` : '';
    return `Sheet ${name}: created with ${change.columns} columns${rows}`;
  }
  return change.addedColumns.length > 0 ? `Sheet ${name}: existing, added columns ${change.addedColumns.join(', ')}` : `Sheet ${name}: existing, nothing to add`;
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
