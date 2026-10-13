import { buildSetupPlan, type SheetSetup } from '@jobhunters/core';
import { GasDrive } from './adapters/gas-drive';
import { ROOT_FOLDER_ID_KEY, SETUP_OK_VERSION_KEY, SPREADSHEET_ID_KEY } from './props';
import { describeSheetChange, reportSetup, type SetupStatus, type SheetChange } from './setup-report';
import { ensureHourlyTrigger, hasHourlyTrigger, TICK_HANDLER } from './triggers';

function getOrCreateRoot(props: GoogleAppsScript.Properties.Properties): { folder: GoogleAppsScript.Drive.Folder; created: boolean } {
  const id = props.getProperty(ROOT_FOLDER_ID_KEY);
  if (id) return { folder: DriveApp.getFolderById(id), created: false };
  const folder = DriveApp.createFolder('JobHunters');
  props.setProperty(ROOT_FOLDER_ID_KEY, folder.getId());
  return { folder, created: true };
}

function getOrCreateSpreadsheet(
  props: GoogleAppsScript.Properties.Properties,
  root: GoogleAppsScript.Drive.Folder,
): { spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet; created: boolean } {
  const id = props.getProperty(SPREADSHEET_ID_KEY);
  if (id) return { spreadsheet: SpreadsheetApp.openById(id), created: false };
  const spreadsheet = SpreadsheetApp.create('JobHunters');
  DriveApp.getFileById(spreadsheet.getId()).moveTo(root);
  props.setProperty(SPREADSHEET_ID_KEY, spreadsheet.getId());
  return { spreadsheet, created: true };
}

function applySheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, plan: SheetSetup): SheetChange {
  let sheet = spreadsheet.getSheetByName(plan.name);
  const isNew = sheet === null;
  if (sheet === null) sheet = spreadsheet.insertSheet(plan.name);
  const rows = sheet.getMaxRows();

  // Text format first, so headers and seed values are stored as typed and later "=..." text is never evaluated.
  for (const column of plan.textColumns) sheet.getRange(1, column, rows, 1).setNumberFormat('@');

  let addedColumns: string[] = [];
  if (!isNew) {
    // A sheet from an older version gets the columns added since, at the end; data is never touched.
    const width = Math.max(sheet.getLastColumn(), 1);
    const have = sheet.getRange(1, 1, 1, width).getValues()[0] as string[];
    const missing = plan.headers.filter((header) => !have.includes(header));
    addedColumns = missing;
    if (missing.length > 0) sheet.getRange(1, width + 1, 1, missing.length).setValues([[...missing]]).setFontWeight('bold');
  }

  if (isNew) {
    sheet.getRange(1, 1, 1, plan.headers.length).setValues([[...plan.headers]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    if (plan.seedRows.length > 0) {
      sheet.getRange(2, 1, plan.seedRows.length, plan.headers.length).setValues(plan.seedRows.map((row) => [...row]));
    }
  }
  // Validation, not insertCheckboxes(): that writes FALSE into every row, so the sheet would look full.
  const checkbox = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  for (const column of plan.checkboxColumns) sheet.getRange(2, column, rows - 1, 1).setDataValidation(checkbox);
  for (const dropdown of plan.dropdowns) {
    // Invalid values stay allowed: Claude or the user may write others, and the app reports them as warnings.
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(dropdown.values, true).setAllowInvalid(true).build();
    sheet.getRange(2, dropdown.column, rows - 1, 1).setDataValidation(rule);
  }
  // Profile is a key/value sheet: a newer version may need more keys, which are added with an empty value.
  let addedRows: string[] = [];
  if (!isNew && plan.name === 'Profile') {
    addedRows = missingProfileKeys(sheet, plan);
    if (addedRows.length > 0) {
      const first = Math.max(sheet.getLastRow(), 1) + 1;
      sheet.getRange(first, 1, addedRows.length, plan.headers.length).setValues(addedRows.map((key) => [key, ''].slice(0, plan.headers.length)));
    }
  }
  // The column is plain text (set above), so a plain setValue keeps "+420 ..." literal.
  const repaired = plan.name === 'Profile' ? brokenProfileValues(sheet) : [];
  for (const cell of repaired) sheet.getRange(cell.row, 2).setValue(cell.text);
  return { created: isNew, columns: plan.headers.length, seedRows: isNew ? plan.seedRows.length : 0, addedColumns, addedRows, repairedValues: repaired.map((cell) => cell.key) };
}

/** The keys of the Profile rows that the plan lists but the sheet lacks (a newer version added keys). */
function missingProfileKeys(sheet: GoogleAppsScript.Spreadsheet.Sheet, plan: SheetSetup): string[] {
  const last = sheet.getLastRow();
  const have = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map((row) => String(row[0])) : [];
  return plan.seedRows.map((row) => String(row[0])).filter((key) => !have.includes(key));
}

/**
 * Profile values that an older version stored as "=+420 ..." (it wrote text starting with + as rich text, and Sheets
 * put an = in front). `text` is the original text.
 */
function brokenProfileValues(sheet: GoogleAppsScript.Spreadsheet.Sheet): { row: number; key: string; text: string }[] {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const found: { row: number; key: string; text: string }[] = [];
  sheet.getRange(2, 1, last - 1, 2).getValues().forEach((cells, index) => {
    const value = cells[1];
    if (typeof value === 'string' && /^=[+\-@]/.test(value)) found.push({ row: index + 2, key: String(cells[0]), text: value.slice(1) });
  });
  return found;
}

/** Every planned header must be in the first row of the sheet; otherwise the app would fail later with a confusing error. */
function missingHeaders(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, plan: SheetSetup): string[] {
  const sheet = spreadsheet.getSheetByName(plan.name);
  if (sheet === null) return [...plan.headers];
  return headersMissingIn(sheet, plan);
}

/** The first row is read in ONE call ('1:1'); asking for the last column first made every sheet cost three calls. */
function headersMissingIn(sheet: GoogleAppsScript.Spreadsheet.Sheet, plan: SheetSetup): string[] {
  const have = sheet.getRange('1:1').getValues()[0] as string[];
  return plan.headers.filter((header) => !have.includes(header));
}

/** The names among `names` that are not child folders of `root`: one query instead of one call per name. */
function missingChildFolders(root: GoogleAppsScript.Drive.Folder, names: readonly string[]): string[] {
  const query = `trashed = false and (${names.map((name) => `title = '${name}'`).join(' or ')})`;
  const found = new Set<string>();
  const folders = root.searchFolders(query);
  while (folders.hasNext()) found.add(folders.next().getName());
  return names.filter((name) => !found.has(name));
}

/**
 * Read-only: what setup() would still have to create. It looks at the stored ids, the sheets and their columns, the
 * Profile rows, the Drive folders and the hourly trigger, and changes nothing.
 */
export function checkSetup(): SetupStatus {
  const reasons: string[] = [];
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty(ROOT_FOLDER_ID_KEY);
  const sheetId = props.getProperty(SPREADSHEET_ID_KEY);
  if (!rootId || !sheetId) return { needed: true, reasons: ['The folder or the spreadsheet has not been created yet'] };

  const spreadsheet = SpreadsheetApp.openById(sheetId);
  // Every sheet is asked for once, here, not by name one at a time: each call to Google costs a few hundred milliseconds.
  const sheets = new Map(spreadsheet.getSheets().map((candidate) => [candidate.getName(), candidate]));
  for (const plan of buildSetupPlan()) {
    const sheet = sheets.get(plan.name);
    if (sheet === undefined) {
      reasons.push(`Sheet ${plan.name} is missing`);
      continue;
    }
    const missing = headersMissingIn(sheet, plan);
    if (missing.length > 0) reasons.push(`Sheet ${plan.name} lacks the columns ${missing.join(', ')}`);
    if (plan.name === 'Profile') {
      const absent = missingProfileKeys(sheet, plan);
      if (absent.length > 0) reasons.push(`Sheet Profile lacks the rows ${absent.join(', ')}`);
      const broken = brokenProfileValues(sheet).map((cell) => cell.key);
      if (broken.length > 0) reasons.push(`Sheet Profile has values that start with "=" (${broken.join(', ')})`);
    }
  }

  const root = DriveApp.getFolderById(rootId);
  for (const name of missingChildFolders(root, ['Profile', 'Templates', 'Companies'])) reasons.push(`Drive folder ${name} is missing`);
  if (!hasHourlyTrigger()) reasons.push('The hourly trigger is missing');
  return { needed: reasons.length > 0, reasons };
}

/**
 * The check is slow (it opens the spreadsheet and looks at every sheet, the Drive folders and the triggers), and the web
 * app asks on every start. So a check that found nothing to do is remembered for the app version, and the next start
 * answers at once. A new version checks again once; setup() and the Setup button remember it as well.
 */
export function checkSetupCached(version: string): SetupStatus {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(SETUP_OK_VERSION_KEY) === version) return { needed: false, reasons: [] };
  const status = checkSetup();
  if (!status.needed) props.setProperty(SETUP_OK_VERSION_KEY, version);
  return status;
}

/** Remembers that setup has nothing left to do for this version (used after a setup run that ended OK). */
export function rememberSetupDone(version: string): void {
  PropertiesService.getScriptProperties().setProperty(SETUP_OK_VERSION_KEY, version);
}

/**
 * Timing diagnostic for the setup check, which makes the red mark late at start. Read-only: times every part of
 * checkSetup() (stored ids, opening the spreadsheet, the sheets and their headers by the current way and by one batched
 * way, Profile, Drive, triggers) and the whole check twice, and changes nothing. Run it from the editor and read the log.
 */
export function runSetupTimingTest(write: (line: string) => void): string {
  const time = <T>(label: string, fn: () => T): T => {
    const started = Date.now();
    const result = fn();
    write(`${label}: ${Date.now() - started} ms`);
    return result;
  };
  const props = PropertiesService.getScriptProperties();
  const rootId = time('Stored ids', () => props.getProperty(ROOT_FOLDER_ID_KEY));
  const sheetId = props.getProperty(SPREADSHEET_ID_KEY);
  if (!rootId || !sheetId) return 'FAILED: the folder or the spreadsheet has not been created yet';

  const spreadsheet = time('Open the spreadsheet', () => SpreadsheetApp.openById(sheetId));
  const plans = buildSetupPlan();

  const perSheet: { name: string; ms: number }[] = [];
  const currentStarted = Date.now();
  for (const plan of plans) {
    const started = Date.now();
    missingHeaders(spreadsheet, plan);
    perSheet.push({ name: plan.name, ms: Date.now() - started });
  }
  write(`Headers, one sheet at a time by name (${plans.length} sheets, now also one read each): ${Date.now() - currentStarted} ms`);
  const slowest = [...perSheet].sort((a, b) => b.ms - a.ms).slice(0, 3);
  write(`  slowest sheets: ${slowest.map((sheet) => `${sheet.name} ${sheet.ms} ms`).join(', ')}`);

  time('Headers, new way (getSheets once, first row of each sheet in one call)', () => {
    const byName = new Map(spreadsheet.getSheets().map((sheet) => [sheet.getName(), sheet]));
    for (const plan of plans) {
      const sheet = byName.get(plan.name);
      if (sheet !== undefined) headersMissingIn(sheet, plan);
    }
  });

  time('Profile rows and values', () => {
    const profile = spreadsheet.getSheetByName('Profile');
    const plan = plans.find((candidate) => candidate.name === 'Profile');
    if (profile !== null && plan !== undefined) {
      missingProfileKeys(profile, plan);
      brokenProfileValues(profile);
    }
  });

  const root = time('Drive: open the root folder', () => DriveApp.getFolderById(rootId));
  time('Drive folders, old way (one call per name)', () => {
    for (const name of ['Profile', 'Templates', 'Companies']) root.getFoldersByName(name).hasNext();
  });
  time('Drive folders, new way (one query)', () => missingChildFolders(root, ['Profile', 'Templates', 'Companies']));
  time('Drive folders, new way again', () => missingChildFolders(root, ['Profile', 'Templates', 'Companies']));
  time('Triggers', () => hasHourlyTrigger());

  time('Whole check, first run', () => checkSetup());
  time('Whole check, second run', () => checkSetup());
  const remembered = time('Remembered answer (what a normal start costs)', () => props.getProperty(SETUP_OK_VERSION_KEY));
  write(`Remembered version: ${remembered === null ? 'none' : remembered}`);
  return 'OK';
}

/**
 * Manual test of the red "setup needed" mark: deletes the hourly trigger (setup creates it again) and forgets the
 * remembered check, so the next start of the web app shows the mark and "Run setup" makes it disappear.
 */
export function runSetupMarkTest(): string {
  PropertiesService.getScriptProperties().deleteProperty(SETUP_OK_VERSION_KEY);
  let removed = 0;
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === TICK_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  }
  return `Deleted ${removed} hourly trigger(s). Reload the web app: Settings shows a red exclamation mark; press Run setup in Settings > General and it disappears.`;
}

/**
 * Idempotent: run it from the Apps Script editor (after the first deploy and after every update); running it again
 * never overwrites data. Every step is written to the execution log and the last line says OK or NOT OK.
 */
export function runSetup(write: (line: string) => void): string {
  return reportSetup(write, (say) => {
    const props = PropertiesService.getScriptProperties();
    const root = getOrCreateRoot(props);
    say(`Root folder "JobHunters": ${root.created ? 'created' : 'found'} (${root.folder.getUrl()})`);
    const { spreadsheet, created } = getOrCreateSpreadsheet(props, root.folder);
    say(`Spreadsheet "JobHunters": ${created ? 'created' : 'found'} (${spreadsheet.getUrl()})`);

    const plans = buildSetupPlan();
    for (const plan of plans) say(describeSheetChange(plan.name, applySheet(spreadsheet, plan)));

    const placeholder = spreadsheet.getSheetByName('Sheet1');
    if (placeholder !== null && spreadsheet.getSheets().length > 1) {
      spreadsheet.deleteSheet(placeholder);
      say('Empty default sheet "Sheet1": deleted');
    }

    const drive = new GasDrive();
    for (const name of ['Profile', 'Templates', 'Companies']) {
      const existed = root.folder.getFoldersByName(name).hasNext();
      drive.ensureFolder(root.folder.getId(), name);
      say(`Drive folder ${name}: ${existed ? 'found' : 'created'}`);
    }

    say(`Hourly trigger: ${ensureHourlyTrigger() ? 'created' : 'already present'}`);

    const broken = plans.map((plan) => ({ name: plan.name, missing: missingHeaders(spreadsheet, plan) })).filter((sheet) => sheet.missing.length > 0);
    if (broken.length > 0) throw new Error(`Check failed, missing columns: ${broken.map((sheet) => `${sheet.name} (${sheet.missing.join(', ')})`).join('; ')}`);
    say(`Check: all ${plans.length} sheets have every column`);
  });
}

/**
 * Manual check of the column migration: builds a scratch sheet that lacks two columns, runs the same code
 * setup() uses on an existing sheet, checks the result and deletes the sheet. Touches no real data.
 */
export function runSetupColumnsTest(spreadsheetId: string): string {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const name = 'ZZ_SetupTest';
  const old = spreadsheet.getSheetByName(name);
  if (old !== null) spreadsheet.deleteSheet(old);
  const sheet = spreadsheet.insertSheet(name);
  try {
    sheet.getRange(1, 1, 2, 3).setValues([['id', 'title', 'notes'], ['x', 'keep', 'me']]);
    applySheet(spreadsheet, { name, headers: ['id', 'title', 'notes', 'status', 'match_percent'], textColumns: [], checkboxColumns: [], dropdowns: [], seedRows: [] });
    applySheet(spreadsheet, { name, headers: ['id', 'title', 'notes', 'status', 'match_percent'], textColumns: [], checkboxColumns: [], dropdowns: [], seedRows: [] });
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]!.join(',');
    const row = sheet.getRange(2, 1, 1, 3).getValues()[0]!.join(',');
    return header === 'id,title,notes,status,match_percent' && row === 'x,keep,me' ? 'OK' : `FAILED: header=${header} row=${row}`;
  } finally {
    spreadsheet.deleteSheet(sheet);
  }
}

/**
 * Manual check that the red "setup needed" mark clears: it asks what is missing, runs setup, asks again and says OK only
 * when nothing is missing afterwards. Changes data exactly like setup() does, nothing more.
 */
export function runSetupStatusTest(write: (line: string) => void): string {
  const before = checkSetup();
  write(before.needed ? `Before: setup needed: ${before.reasons.join('; ')}` : 'Before: setup not needed');
  const verdict = runSetup(write);
  const after = checkSetup();
  write(after.needed ? `After: still needed: ${after.reasons.join('; ')}` : 'After: setup not needed');
  if (verdict !== 'OK') return `FAILED: setup ${verdict}`;
  return after.needed ? `FAILED: setup ran but is still needed: ${after.reasons.join('; ')}` : 'OK';
}

/**
 * Diagnostic for a text such as "+420 704 145 475" that Sheets turns into "=+420 704 145 475": writes it into a scratch
 * sheet in several ways and reports what each way stores, and reports how the real Profile phone cell looks. Changes
 * nothing except the scratch sheet, which it deletes.
 */
export function runFormulaTextTest(spreadsheetId: string, write: (line: string) => void): string {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const text = '+420 704 145 475';
  const describe = (range: GoogleAppsScript.Spreadsheet.Range): string =>
    `value=${JSON.stringify(range.getValue())} formula=${JSON.stringify(range.getFormula())} shown=${JSON.stringify(range.getDisplayValue())} format=${JSON.stringify(range.getNumberFormat())}`;

  const profile = spreadsheet.getSheetByName('Profile');
  if (profile !== null && profile.getLastRow() > 1) {
    const rows = profile.getRange(2, 1, profile.getLastRow() - 1, 2).getValues();
    rows.forEach((row, index) => {
      if (String(row[0]) === 'phone') write(`Real Profile phone cell (row ${index + 2}): ${describe(profile.getRange(index + 2, 2))}`);
    });
  }

  const name = 'ZZ_FormulaTextTest';
  const old = spreadsheet.getSheetByName(name);
  if (old !== null) spreadsheet.deleteSheet(old);
  const sheet = spreadsheet.insertSheet(name);
  try {
    const cell = (row: number): GoogleAppsScript.Spreadsheet.Range => sheet.getRange(row, 1);
    cell(1).setNumberFormat('@').setValue(text);
    write(`A plain-text cell, setValue:            ${describe(cell(1))}`);
    cell(2).setValue(text);
    write(`B automatic cell, setValue:             ${describe(cell(2))}`);
    cell(3).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).build());
    write(`C automatic cell, rich text:            ${describe(cell(3))}`);
    cell(4).setNumberFormat('@').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).build());
    write(`D plain-text cell, rich text:           ${describe(cell(4))}`);
    cell(5).setValue(`'${text}`);
    write(`E automatic cell, setValue with '       ${describe(cell(5))}`);
    cell(6).setNumberFormat('@').setValue(`=${text}`);
    write(`F plain-text cell, setValue of =text:   ${describe(cell(6))}`);
    cell(7).setFormula(`=${text}`);
    cell(7).setNumberFormat('@');
    write(`G formula cell, then plain-text format: ${describe(cell(7))}`);
    return 'OK';
  } finally {
    spreadsheet.deleteSheet(sheet);
  }
}
