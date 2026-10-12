import { AppError, type SheetName } from '@jobhunters/core';
import { GasDrive } from './adapters/gas-drive';
import { GasPropertyStore } from './adapters/gas-properties';
import { GasPageFetcher } from './adapters/gas-fetcher';
import { gasLock } from './adapters/gas-lock';
import { GasSheetGrid } from './adapters/gas-grid';
import { createApi, toFailure, type ApiResult } from './api';
import { buildContainer, type Container } from './container';
import { createHandlers } from './handlers';
import { getRootFolderId, getSpreadsheetId } from './props';
import { runSetup } from './setup';
import { runSmokeTest } from './smoke';

/** Defined in Version.gs, which Apps Script loads into the same global scope. */
declare const APP_VERSION: string;

let cachedContainer: Container | undefined;
let cached: ReturnType<typeof createApi> | undefined;

function getContainer(): Container {
  if (cachedContainer === undefined) {
    const spreadsheetId = getSpreadsheetId();
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    cachedContainer = buildContainer({
      grid: (sheet: SheetName) => {
        const found = spreadsheet.getSheetByName(sheet);
        if (found === null) throw new AppError('sheet_missing', `Sheet ${sheet} is missing`, { sheet });
        return new GasSheetGrid(found);
      },
      lock: gasLock,
      newId: () => Utilities.getUuid(),
      now: () => new Date().toISOString(),
      clock: () => Date.now(),
      timeZone: () => Session.getScriptTimeZone(),
      schedulerState: new GasPropertyStore(PropertiesService.getScriptProperties()),
      appVersion: APP_VERSION,
      fetcher: new GasPageFetcher(),
      drive: new GasDrive(),
      rootFolder: () => {
        const id = getRootFolderId();
        return { id, url: DriveApp.getFolderById(id).getUrl() };
      },
    });
  }
  return cachedContainer;
}

function getApi(): ReturnType<typeof createApi> {
  if (cached === undefined) {
    const container = getContainer();
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

/**
 * One-click manual check: run it from the Apps Script editor and read the execution log.
 * It writes test data (see smoke.ts); delete the "Smoke Test Ltd" rows and folders afterwards.
 */
export function smokeTest(): string {
  const result = runSmokeTest({
    call: (method, args) => api(method, args),
    createTemplateDoc: (name, text) => {
      const document = DocumentApp.create(name);
      document.getBody().setText(text);
      document.saveAndClose();
      const templatesFolder = new GasDrive().ensureFolder(getRootFolderId(), 'Templates');
      DriveApp.getFileById(document.getId()).moveTo(DriveApp.getFolderById(templatesFolder.id));
      return document.getUrl();
    },
    today: () => new Date().toISOString().slice(0, 10),
    log: (line) => Logger.log(line),
  });
  return result.ok ? 'OK' : `FAILED: ${result.failed.join(', ')}`;
}

/** Fired by the hourly time trigger: starts the scheduled tasks whose hour it is. */
export function onHourlyTick(): void {
  try {
    const timeZone = Session.getScriptTimeZone();
    const now = new Date();
    const slot = { day: Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'), hour: Number(Utilities.formatDate(now, timeZone, 'H')) };
    getContainer().scheduler.tick(slot);
  } catch (error) {
    try {
      getContainer().log('schedule', '', error instanceof Error ? error.message : String(error));
    } catch {
      // Nothing more can be done; the next hour tries again.
    }
  }
}

/** The web app: the single-file UI built from packages/ui (dist/ui.html). */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('ui').setTitle('JobHunters').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
