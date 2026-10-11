# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.8.1] - 2026-10-11

- New "AI prompts" tab in Settings: edit the whole text of every AI task (tailor resume, cover letter, other document, answer a question, evaluate a job match) with {{placeholders}} for the ids, language, limit and your notes; a button resets them to the defaults. The text is copied into the task when it is created. New settings `ai_prompt_*`; the unused Prompts sheet is no longer created.
- The limit of a question is now a maximum number of sentences instead of characters (column `max_length` of the Questions sheet is renamed `max_sentences`; API parameter `maxSentences`). The AI is told the limit in sentences.
- New rows are appended right below the last row that has an id. Before, a checkbox column filled with FALSE in empty rows pushed new rows hundreds of rows below the visible data.

## [0.7.1] - 2026-10-11

- Questions of an application have an "Answer by AI" checkbox with optional own instructions and a button that queues all unanswered questions at once. The AI task (`answer_question`) respects the maximum length and the language of the application and writes the answer into the question. New API methods `requestQuestionAi`, `requestQuestionsAi`.

## [0.7.0] - 2026-10-11

- AI tasks table: the type column names the document (resume or cover letter) and a Company column was added; the detail also shows the company.
- Documents tab of an application shows the state of the AI task as a badge with the processing date, the note written by the AI and a refresh button.

## [0.6.0] - 2026-10-11

- Colour mode switch in Settings (Appearance): follow the device, always light or always dark. New setting `ui_theme`.
- Job detail has tabs: Applications, Notes, Description and Match. Match queues an AI task (`match_job` in the Tasks sheet) that evaluates whether you are a suitable candidate for the role; the result is shown in the tab. Needs the new Experience setting. New API methods `requestJobMatch`, `cancelAiTask`; `getJob` returns the latest match task.
- New "AI tasks" screen in the main menu: lists every task with its state and result and can remove a stuck one. New API methods `listAiTasks`, `removeAiTask`.
- The application detail shows the language of its documents.
- Documents of an application have a "Content by AI" checkbox with optional own instructions: it queues an AI task (`cover_letter`, `resume_tailor` or `other`) that writes the Google Doc in the language of the application. New API method `requestDocumentAi`; `getApplication` returns the tasks of the application.
- Settings are split into tabs: General, Documents, Experience, Profile, Templates, Statuses and About. New setting `candidate_experience`.

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
