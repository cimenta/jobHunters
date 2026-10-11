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
- Quick check of everything below: run the function `smokeTest` in the editor and read the execution log. It creates two template Docs, a test job "Smoke Test Ltd" and an application with PDF, question, note and reminder, and prints `ALL STEPS PASSED` or the failing step. Delete the test rows and folders afterwards.
- Create two Google Docs in `JobHunters/Templates` with the text `Dear {{company}}, I am {{name}}, applying for {{position}} on {{date}}. {{body}}`. Register each: `api('addTemplate', {type: 'resume', language: 'en', name: 'Resume', docUrl: '<Doc address>'})` and the same with `cover_letter`. Fill your details: `api('updateProfile', {name: '...', email: '...'})`.
- `api('createApplication', {jobId: '<id from the Jobs sheet>'})` creates a draft, a folder `JobHunters/Companies/<company>/<title>/<label>/` and two Docs with the placeholders replaced; `{{body}}` stays. A missing template shows up as a `template_missing` warning, not an error.
- `api('exportDocumentPdf', {id: '<document id>'})` puts a PDF into the application folder; edit the Doc and run `api('getApplication', {id: '<application id>'})`: the document now has `pdf_stale: true`.
- `api('previewDocument', {id: '<document id>'})` returns HTML without scripts. `addQuestion`, `answerQuestion` (try an answer over the limit), `addCommunication` and `addReminder` appear in `getApplication` and its `timeline`.
