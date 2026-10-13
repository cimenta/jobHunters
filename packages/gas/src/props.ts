import { AppError } from '@jobhunters/core';

export const SPREADSHEET_ID_KEY = 'SPREADSHEET_ID';
export const ROOT_FOLDER_ID_KEY = 'ROOT_FOLDER_ID';
/** The app version for which a check found nothing left for setup() to do; the next check of that version is skipped. */
export const SETUP_OK_VERSION_KEY = 'SETUP_OK_VERSION';

export function getSpreadsheetId(): string {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!id) throw new AppError('setup_required', 'Run setup() first');
  return id;
}

export function getRootFolderId(): string {
  const id = PropertiesService.getScriptProperties().getProperty(ROOT_FOLDER_ID_KEY);
  if (!id) throw new AppError('setup_required', 'Run setup() first');
  return id;
}
