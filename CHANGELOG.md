# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.5.0] - 2026-10-11

- Web interface (Svelte), responsive for phone, tablet and desktop, served by the web app: Dashboard, Jobs (list, add by link or pasted text, detail), Applications (status, documents with preview and PDF export, questions, communication, reminders, timeline), Companies and Settings.
- Status labels can be edited: text per language and colour of every status (`status_styles` setting).
- New API methods: `getJob`, `updateJob`, `listCompanies`, `getCompany`, `updateCompany`, `getDashboard`; `listJobs` and `listApplications` now include company names and counts.
- Development mode: `npm run dev -w @jobhunters/ui` runs the interface in a browser against an in-memory copy of the backend.
- Delete an application from the Timeline tab (with confirmation): removes it with its documents, questions, communication and reminders and can move its Drive folder to the trash. New API method `deleteApplication`.
- Creating an application always creates its documents: without a template of the right type and language an empty Google Doc is created and a warning explains it.

## [0.4.0] - 2026-10-11

- Applications: create an application from a saved job (draft, label, Drive folder, documents filled from Google Doc templates with profile, company and job data), "apply again" copies earlier documents, add more documents from templates.
- Documents: PDF export with stale detection, sanitised HTML preview.
- Questions with optional maximum length, communications, manual reminders with dashboard grouping, and a computed timeline.
- Templates and Profile sheets are managed through the API; the Profile sheet is seeded with its keys.
- New API methods: `getProfile`, `updateProfile`, `listTemplates`, `addTemplate`, `createApplication`, `addApplicationDocument`, `listApplications`, `getApplication`, `exportDocumentPdf`, `previewDocument`, and question, communication and reminder methods.

## [0.3.0] - 2026-10-11

- Add a job ad by link: URL normalisation and duplicate detection, parsers for Jobs.cz, StartupJobs and LinkedIn plus a generic JSON-LD/OpenGraph parser, paste-the-text fallback when a portal blocks the download, company merge, and an HTML snapshot of the ad in Drive.
- New API methods: `previewJob`, `saveJob`, `listJobs`.

## [0.2.0] - 2026-10-11

- Google Apps Script layer: Sheets-backed repositories, typed settings, one-time `setup()`, single `api()` entry point and an esbuild bundle for `clasp push`.
- Schema for all sheets; document and ad language columns.
- English and Czech message catalogs; errors carry a code and parameters for translation.
- Drive/Docs gateway interface with folder and placeholder helpers.

## [0.1.0] - 2026-10-10

- Initial project scaffold: TypeScript workspace, domain core, versioning.
