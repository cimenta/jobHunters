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
import { checkSetup, checkSetupCached, rememberSetupDone, runFormulaTextTest, runSetup, runSetupColumnsTest, runSetupMarkTest, runSetupStatusTest, runSetupTimingTest } from './setup';
import type { SetupResult } from './setup-report';
import { runSmokeTest } from './smoke';

/** Defined in Version.gs, which Apps Script loads into the same global scope. */
declare const APP_VERSION: string;

let cachedContainer: Container | undefined;
let cached: ReturnType<typeof createApi> | undefined;

/** The Settings button: the same steps as setup(), with the log lines and the verdict handed to the page. */
function runSetupForApp(): SetupResult {
  const lines: string[] = [];
  const verdict = runSetup((line) => {
    lines.push(line);
    Logger.log(line);
  });
  // The sheets may have changed shape; the next call builds a fresh container.
  cachedContainer = undefined;
  cached = undefined;
  let ok = verdict === 'OK';
  // One-time steps: the ads that already have an application are moved from New to Applied or Archived, and the
  // formats of the sheet columns (which this Setup has just put right by column name) are remembered as repaired.
  if (ok) {
    try {
      getContainer().settings.update({ sheet_formats_repaired: '1', communication_kinds_listed: '1' });
      const moved = getContainer().jobStatusMigration.run();
      lines.push(`Job statuses: ${moved} ads with an application moved from New to Applied or Archived`);
    } catch (error) {
      lines.push(`Job statuses could not be moved: ${error instanceof Error ? error.message : String(error)}`);
      ok = false;
    }
  }
  // Ask again, so a setup that did not fix everything says so instead of leaving the red mark unexplained.
  try {
    const after = checkSetup();
    lines.push(after.needed ? `Still needed after setup: ${after.reasons.join('; ')}` : 'Check after setup: nothing is missing');
    if (after.needed) ok = false;
    else rememberSetupDone(APP_VERSION);
  } catch (error) {
    lines.push(`Check after setup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { ok, lines };
}

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
      runSetup: runSetupForApp,
      setupStatus: () => checkSetupCached(APP_VERSION),
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

/**
 * What the web app calls: the same answer as api(), but as ONE JSON string. google.script.run drops the null properties of
 * objects (they arrive as undefined: an empty salary, an ad without a match), a string keeps them.
 */
export function apiJson(method: string, args?: unknown): string {
  return JSON.stringify(api(method, args));
}

/**
 * Run from the Apps Script editor after deploying (the first function of the file, so it is the default choice):
 * creates or updates the folder, the spreadsheet, its sheets and the hourly trigger. The execution log lists
 * what it did and ends with "Setup finished: OK" or "NOT OK"; the same verdict is the return value.
 */
export function setup(): string {
  const verdict = runSetup((line) => Logger.log(line));
  if (verdict === 'OK' && !checkSetup().needed) rememberSetupDone(APP_VERSION);
  return verdict;
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

/** Manual check of the column migration of setup(); run it from the editor and read the result. Leaves no data behind. */
export function testSetupColumns(): string {
  const result = runSetupColumnsTest(getSpreadsheetId());
  Logger.log(result);
  return result;
}

/**
 * Manual check of the red "setup needed" mark: reports what is missing, runs setup, checks again and returns OK only
 * when nothing is missing afterwards. Run it from the editor and read the execution log.
 */
export function testSetupStatus(): string {
  const result = runSetupStatusTest((line) => Logger.log(line));
  Logger.log(result);
  return result;
}

/**
 * Manual test of the red exclamation mark in the web app: deletes the hourly trigger, so the next start of the web app
 * shows the mark. Press Run setup in Settings > General (or run setup() here) and it disappears.
 */
export function testSetupMark(): string {
  const result = runSetupMarkTest();
  Logger.log(result);
  return result;
}

/**
 * Diagnostic of the start of the web app: times every part of the setup check (it makes the red mark late), then the
 * building of the app and one call for the menu numbers. Read-only; run it from the editor and read the execution log.
 */
export function testStartupTiming(): string {
  const write = (line: string): void => {
    Logger.log(line);
  };
  const result = runSetupTimingTest(write);
  const time = <T>(label: string, fn: () => T): T => {
    const started = Date.now();
    const value = fn();
    write(`${label}: ${Date.now() - started} ms`);
    return value;
  };
  cachedContainer = undefined;
  cached = undefined;
  time('Build the app (first call)', () => getApi());
  time('Menu numbers, first call', () => api('getMenuCounts'));
  time('Menu numbers, second call', () => api('getMenuCounts'));
  time('Settings', () => api('getSettings'));
  Logger.log(result);
  return result;
}

/** Diagnostic: how Sheets stores a text like "+420 704 145 475"; run it from the editor and read the execution log. */
export function testFormulaText(): string {
  const result = runFormulaTextTest(getSpreadsheetId(), (line) => Logger.log(line));
  Logger.log(result);
  return result;
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
