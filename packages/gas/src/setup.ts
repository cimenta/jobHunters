import { buildSetupPlan, type SheetSetup } from '@jobhunters/core';
import { GasDrive } from './adapters/gas-drive';
import { ROOT_FOLDER_ID_KEY, SPREADSHEET_ID_KEY } from './props';
import { ensureHourlyTrigger } from './triggers';

function getOrCreateRoot(props: GoogleAppsScript.Properties.Properties): GoogleAppsScript.Drive.Folder {
  const id = props.getProperty(ROOT_FOLDER_ID_KEY);
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('JobHunters');
  props.setProperty(ROOT_FOLDER_ID_KEY, folder.getId());
  return folder;
}

function getOrCreateSpreadsheet(
  props: GoogleAppsScript.Properties.Properties,
  root: GoogleAppsScript.Drive.Folder,
): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = props.getProperty(SPREADSHEET_ID_KEY);
  if (id) return SpreadsheetApp.openById(id);
  const spreadsheet = SpreadsheetApp.create('JobHunters');
  DriveApp.getFileById(spreadsheet.getId()).moveTo(root);
  props.setProperty(SPREADSHEET_ID_KEY, spreadsheet.getId());
  return spreadsheet;
}

function applySheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, plan: SheetSetup): void {
  let sheet = spreadsheet.getSheetByName(plan.name);
  const isNew = sheet === null;
  if (sheet === null) sheet = spreadsheet.insertSheet(plan.name);
  const rows = sheet.getMaxRows();

  // Text format first, so headers and seed values are stored as typed and later "=..." text is never evaluated.
  for (const column of plan.textColumns) sheet.getRange(1, column, rows, 1).setNumberFormat('@');

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
}

/** Idempotent: run it once from the Apps Script editor; running it again never overwrites data. */
export function runSetup(): { spreadsheetUrl: string; rootFolderUrl: string } {
  const props = PropertiesService.getScriptProperties();
  const root = getOrCreateRoot(props);
  const spreadsheet = getOrCreateSpreadsheet(props, root);
  for (const plan of buildSetupPlan()) applySheet(spreadsheet, plan);

  const placeholder = spreadsheet.getSheetByName('Sheet1');
  if (placeholder !== null && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(placeholder);

  const drive = new GasDrive();
  for (const name of ['Profile', 'Templates', 'Companies']) drive.ensureFolder(root.getId(), name);
  ensureHourlyTrigger();
  return { spreadsheetUrl: spreadsheet.getUrl(), rootFolderUrl: root.getUrl() };
}
