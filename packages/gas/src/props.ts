import { AppError } from '@jobhunters/core';

export const SPREADSHEET_ID_KEY = 'SPREADSHEET_ID';
export const ROOT_FOLDER_ID_KEY = 'ROOT_FOLDER_ID';

export function getSpreadsheetId(): string {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!id) throw new AppError('setup_required', 'Run setup() first');
  return id;
}
