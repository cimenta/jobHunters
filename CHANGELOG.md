# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.11.3] - 2026-10-12

- Notices are more informative: they name what was changed and, for a change, from what to what.

## [0.11.2] - 2026-10-12

- `setup()` is the first function in the Apps Script editor's function list, so it is preselected. It writes every step it performed to the execution log (folder, spreadsheet, each sheet created or extended with which columns, Drive folders, the hourly trigger), checks at the end that every sheet has all its columns, and ends with "Setup finished: OK" or "Setup finished: NOT OK" with the reason. It returns "OK" or "NOT OK: reason".
- The Help screen is split into tabs, one per topic.

## [0.11.1] - 2026-10-12

- New Help item in the main menu: explains how the application works, the typical flow and what each screen and Settings tab does.

## [0.11.0] - 2026-10-12

- A short notice appears when an operation finishes, on success and on failure; every operation reports now. New setting `result_notices` (Settings → General → Notices) switches the notices off. When off, a failed operation shows nothing; loading errors stay on the screen.

## [0.10.6] - 2026-10-12

- Settings: the Statuses tab is split into "Status labels" and "Allowed status changes".

## [0.10.5] - 2026-10-12

- Kanban: a "Hide empty columns" checkbox hides columns without applications; the choice is remembered (in `ui_state`).

## [0.10.4] - 2026-10-12

- The application detail opens as a pop-up over the list instead of a separate page; closing it returns to the list (or Kanban board) exactly as it was.

## [0.10.3] - 2026-10-12

- Kanban view of the applications: a "Kanban" switch in the list shows a column per status. Drag a card to another column to change its status (moving to Waiting asks for the reminder date) or within a column to change its order; every card also has a "Move to…" menu for touch screens. The order is stored in the new column `board_position` of the Applications sheet.
- The status filter of the applications is a multiple choice. The selection is remembered separately for the list and for the board (in the board it chooses the columns shown), and so is the Kanban switch; all of it is stored in the app (new setting `ui_state`).
- New setting `status_transitions` and a matrix in Settings, tab Statuses, to choose which status an application may move to. It applies everywhere (status control, Kanban, backend); the built-in rules are the default. Moving to Waiting still creates the reminder. New API method `moveApplication`.
- Run `setup()` after deploying so the sheet gets the new column.

## [0.10.2] - 2026-10-12

- `testSetupColumns` writes its result (`OK` or `FAILED: ...`) to the execution log, where the Apps Script editor shows it.

## [0.10.1] - 2026-10-12

- New function `testSetupColumns` to run from the Apps Script editor: it checks on a scratch sheet that `setup()` adds missing columns to an existing sheet without touching its data, and deletes the sheet again.

## [0.10.0] - 2026-10-12

- Ads have a status. Built-in: New and No; you can change their text and colour, add statuses of your own and delete them (not while an ad uses one) in Settings, tab "Ad statuses". Each status has a "Check availability" checkbox; the regular availability check follows it for ads without an application. The status is chosen in the ad and shown in the list, which can be filtered by it.
- The AI match evaluation writes the match as a whole number 0-100 into the new column `match_percent`. A New ad that was evaluated shows "Match 78 %" coloured by the number (red below 40, orange below 70, green from 70). Use "Reset all to default" in Settings, tab "AI prompts", to get the new match prompt.
- New columns `status` and `match_percent` in the Jobs sheet; `setup()` adds missing columns to existing sheets without touching data, so run `setup()` right after deploying. New API method `saveJobStatuses`; `updateJob` accepts `status`.

## [0.9.1] - 2026-10-12

- The time zone of the application is Europe/Prague (`timeZone` in `appsscript.json`): the hours of the scheduled tasks and every time shown in the interface use it, instead of UTC.

## [0.9.0] - 2026-10-12

- Availability check of ads. New "Availability" tab in Settings: switch the regular check on, choose the hours of the day (for example `8, 18`), tick which reasons mark an ad offline at once (page not found, redirect to another address, expired validity, an offline text); the other reasons need two checks in a row. The list of offline texts can be edited there.
- "Availability" button in the ad checks it immediately and explains the result; an ad that is online again is brought back from offline.
- A status of an application has a "Check availability" checkbox. The regular check visits ads without an application and ads with an application in a ticked status, the longest unchecked first, within about five minutes.
- One hourly trigger starts scheduled tasks (the availability check now, more later). Run `setup()` once from the Apps Script editor after deploying to install it.
- Downloads follow redirects one step at a time and report the final address. New API method `checkJobAvailability`; `getAppInfo` returns `timeZone`.
- Every time in the interface is shown in the time zone of the script. Removed the unused setting `availability_check_days`.

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
