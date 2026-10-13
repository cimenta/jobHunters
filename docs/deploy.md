# Deploying to Google Apps Script

1. `npm install`, then `npm run build` (writes `dist/`).
2. Create an Apps Script project (script.google.com), copy `.clasp.json.example` to `.clasp.json` and set your script ID. Never commit `.clasp.json`.
3. `npx clasp login`, then `npx clasp push`.
4. In the Apps Script editor run `setup` once and grant the permissions. It creates the `JobHunters` folder, the spreadsheet with all sheets, and stores their IDs in the script properties. Running it again never overwrites data.
5. Deploy as a web app (execute as you, access only you) and open the URL: it shows `JobHunters <version>`.

## Smoke test

`api` takes arguments, so call it from a throwaway function in the editor, for example
`function t() { Logger.log(JSON.stringify(api('getAppInfo'))); }`, and run `t`. Use the same pattern for the calls below.

- `api('getAppInfo')` returns `{ok: true, data: {version, locales}}`. This also proves `Version.gs` is visible to the bundle.
- `api('getSettings')` returns the defaults with no warnings.
- Type `=1+1` into a `notes` cell of the `Companies` sheet and read it back through the app: it stays text.
- Reorder two columns in the `Companies` sheet and add a column of your own; `api('getWarnings')` stays empty and your column survives an update.
- Add a row to `Applications` with the status `weird`: `api('getWarnings')` reports it and the app keeps working.
- Run `setup` a second time: no sheet is duplicated and no data changes.
- `api('previewJob', {url: '<link to a live job ad>'})` returns the fields found and writes nothing. Try one link per portal; if a portal answers 403/429 you get `fetched: false`.
- `api('saveJob', {url: '<same link>'})` adds a row to `Jobs` and a company to `Companies`, and a `snapshot.html` appears under `JobHunters/Companies/<company>/<title>/`. Saving the same link again returns `status: "duplicate"`.
- `api('saveJob', {url: '<link>', text: 'Title\n\nPasted ad text...'})` saves from pasted text.
- Check of the red "setup needed" mark: run the function `testSetupStatus` in the editor and read the execution log. It lists what was missing, runs setup, checks again and returns `OK` only when nothing is missing afterwards (otherwise `FAILED` with the reasons).
- Diagnostic for a phone number that shows up as "=+420 ...": run the function `testFormulaText` in the editor and read the execution log. It shows how the real Profile phone cell looks and how Sheets stores such a text written in several ways, in a scratch sheet that it deletes.
- Timing of the start of the web app: run the function `testStartupTiming` in the editor and read the execution log. It is read-only and lists how long each part of the setup check (the slow question behind the red mark) takes, then how long building the app and the menu numbers take.
- Test of the red exclamation mark by Settings in the web app: run the function `testSetupMark` in the editor (it deletes the hourly trigger and forgets the remembered check), reload the web app, see the mark in the main menu and on the Setup card, press "Run setup" in Settings > General and watch it disappear (setup creates the trigger again).
- Quick check of everything below: run the function `smokeTest` in the editor and read the execution log. It creates two template Docs, a test job "Smoke Test Ltd" and an application with PDF, question, note and reminder, and prints `ALL STEPS PASSED` or the failing step. Delete the test rows and folders afterwards.
- Create two Google Docs in `JobHunters/Templates` with the text `Dear {{company}}, I am {{name}}, applying for {{position}} on {{date}}. {{body}}`. Register each: `api('addTemplate', {type: 'resume', language: 'en', name: 'Resume', docUrl: '<Doc address>'})` and the same with `cover_letter`. Fill your details: `api('updateProfile', {name: '...', email: '...'})`.
- `api('createApplication', {jobId: '<id from the Jobs sheet>'})` creates a draft, a folder `JobHunters/Companies/<company>/<title>/<label>/` and two Docs with the placeholders replaced; `{{body}}` stays. A missing template shows up as a `template_missing` warning, not an error, and an empty Doc is created in its place.
- `api('exportDocumentPdf', {id: '<document id>'})` puts a PDF into the application folder; edit the Doc and run `api('getApplication', {id: '<application id>'})`: the document now has `pdf_stale: true`.
- `api('previewDocument', {id: '<document id>'})` returns HTML without scripts. `addQuestion`, `answerQuestion` (try an answer over the limit), `addCommunication` and `addReminder` appear in `getApplication` and its `timeline`.

## Using the web app

After `npm run build` and `clasp push`, deploy the project as a web app (execute as you, access only you) and open its URL. The page loads `ui.html`. Open it on your phone as well and add it to the home screen.

Developing the interface without Google: `npm run dev -w @jobhunters/ui` and open the printed address. The page runs against demo data held in memory; reload resets it. Open it with `?demo` (for example `http://localhost:5173/?demo#/jobs`) for a larger set of fictional jobs and applications, and with `?demo=kanban` for the applications as a board.

First look in the real app:

1. Settings → Profile: fill in your details. Settings → Templates: add the addresses of your Google Docs templates.
2. Jobs → Add job: paste the link to an ad, check the details, save. If the portal blocks the download, paste the text of the ad.
3. Open the job → Create application. Open the application: preview a document, open it in Google Docs, export the PDF.
4. Change the status (Waiting asks for a reminder date), add a question, a note and a reminder, and look at the Timeline.
5. Settings → Statuses → Application statuses: change the text and colour of a status and check that lists and detail pages follow.
