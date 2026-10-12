import { buildSetupPlan, type SheetSetup } from '@jobhunters/core';
import { GasDrive } from './adapters/gas-drive';
import { ROOT_FOLDER_ID_KEY, SPREADSHEET_ID_KEY } from './props';
import { describeSheetChange, reportSetup, type SheetChange } from './setup-report';
import { ensureHourlyTrigger } from './triggers';

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
  return { created: isNew, columns: plan.headers.length, seedRows: isNew ? plan.seedRows.length : 0, addedColumns };
}

/** Every planned header must be in the first row of the sheet; otherwise the app would fail later with a confusing error. */
function missingHeaders(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, plan: SheetSetup): string[] {
  const sheet = spreadsheet.getSheetByName(plan.name);
  if (sheet === null) return [...plan.headers];
  const have = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] as string[];
  return plan.headers.filter((header) => !have.includes(header));
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
