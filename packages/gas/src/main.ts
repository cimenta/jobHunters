import { AppError, type SheetName } from '@jobhunters/core';
import { GasDrive } from './adapters/gas-drive';
import { GasPageFetcher } from './adapters/gas-fetcher';
import { gasLock } from './adapters/gas-lock';
import { GasSheetGrid } from './adapters/gas-grid';
import { createApi, toFailure, type ApiResult } from './api';
import { buildContainer } from './container';
import { createHandlers } from './handlers';
import { getRootFolderId, getSpreadsheetId } from './props';
import { runSetup } from './setup';

/** Defined in Version.gs, which Apps Script loads into the same global scope. */
declare const APP_VERSION: string;

let cached: ReturnType<typeof createApi> | undefined;

function getApi(): ReturnType<typeof createApi> {
  if (cached === undefined) {
    const spreadsheetId = getSpreadsheetId();
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const container = buildContainer({
      grid: (sheet: SheetName) => {
        const found = spreadsheet.getSheetByName(sheet);
        if (found === null) throw new AppError('sheet_missing', `Sheet ${sheet} is missing`, { sheet });
        return new GasSheetGrid(found);
      },
      lock: gasLock,
      newId: () => Utilities.getUuid(),
      now: () => new Date().toISOString(),
      appVersion: APP_VERSION,
      fetcher: new GasPageFetcher(),
      drive: new GasDrive(),
      rootFolder: () => {
        const id = getRootFolderId();
        return { id, url: DriveApp.getFolderById(id).getUrl() };
      },
    });
    cached = createApi({ handlers: createHandlers(container), log: container.log });
  }
  return cached;
}

/** Single entry point for google.script.run. */
export function api(method: string, args?: unknown): ApiResult {
  try {
    return getApi()(method, args);
  } catch (error) {
    return toFailure(error);
  }
}

/** Run once from the Apps Script editor. */
export function setup(): { spreadsheetUrl: string; rootFolderUrl: string } {
  return runSetup();
}

/** Placeholder until the UI plan: lets you confirm the web app deployment works. */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutput(`JobHunters ${APP_VERSION}`);
}
