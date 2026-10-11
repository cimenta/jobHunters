# JobHunters

Manage and prepare job applications. Runs for free on your own Google account:
Google Apps Script (backend and web UI), Google Sheets (data), Google Drive and Docs (files and documents).

**Status:** early development. The domain core is in place; the Google Apps Script layer and the UI are being built.

## What it will do

- Keep a list of companies, job ads and your applications to them, with a copy of each ad.
- Check whether an ad is still online.
- Build application documents from templates, edit them in Google Docs, export PDFs.
- Track status, communication and reminders on a timeline.
- Queue writing tasks for an AI assistant that works on the same spreadsheet.

## Development

Requires Node.js 22.12+.

```bash
npm install
npm run typecheck
npm test
```

Layout:

- `packages/core` – pure TypeScript domain logic, no Google APIs.
- `packages/gas` – Apps Script code (`Version.gs` holds the app version).

Copy `.clasp.json.example` to `.clasp.json` and set your own script ID when you start deploying with `clasp`.
Never commit `.clasp.json`, `.clasprc.json` or `.env`.

## License

MIT
