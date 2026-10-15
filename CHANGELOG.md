# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.16.11] - 2026-10-15

- The job detail had two buttons that delete the job (the trash icon under the status and a red button at the bottom). The red button is gone; the trash icon stays. A job that waits for the AI keeps its own delete button in its notice.
- The Jobs filters have a new checkbox "Hide No" that hides the jobs whose status is No. It is remembered like "Hide with application", "Clear filters" switches it off, and its label follows the name you gave the status No in Settings.
- All checkboxes of the app are smaller (16 px instead of 20 px); the whole label stays clickable.
- No Setup is needed for this update.

## [0.16.10] - 2026-10-15

- A job has a new field "Contact person" (the person the ad names as responsible for the position or as a contact, free text). It is shown in the facts of the job detail and of the application detail and changed by a double-click (Enter or leaving the field saves, Esc cancels).
- When you set the status of a job to No, the new field "Reason why not" opens at once so you can write why (Esc skips it). It stays visible while it has text, and a double-click changes it.
- "Create AI job to import" in Add job has a field "Extra instructions for the AI (optional)". The text goes into the task. A prompt kept from an older version has no place for it, so the text is added at the end of the task.
- The AI prompts changed: the evaluation of the match (match_job) now also ticks is_remote and is_hybrid from the ad (it never clears them) and fills contact_person when the cell is empty and the ad names a person; the import prompts fill contact_person too, and the import-and-match prompt has the place for the extra instructions. This also brings the earlier change of the work mode columns (is_remote, is_hybrid instead of remote) into your prompts.
- **Run Setup after the update** (Settings > General > Run setup): the sheet Jobs gets the columns contact_person and no_reason. Until then the screens that read jobs fail with a missing-column error. **Then update the prompts yourself**: the red "!" by Settings (tab AI prompts) says the built-in prompts changed; press "Reset all to default" to take them (it replaces your own edits of the prompts) or "Keep my prompts" to hide the notice (the AI then does not fill the new fields).

## [0.16.9] - 2026-10-15

- You choose which numbers the main menu shows. In Settings > General, on the card "Menu numbers", each of Jobs, Applications and AI tasks has two choices: a first number and an optional second one, shown as "first / second". Jobs can show new jobs, new jobs with no application, all jobs with no application or all jobs; Applications drafts, waiting for a reply, sent or all active; AI tasks waiting, needing your answer or failed. The choice is saved at once. The defaults are what the menu showed before (new jobs, drafts, waiting tasks), so nothing changes until you pick something else.
- Point at a number in the menu to read what it means, one line per number, for example "New jobs with no application: 3". A badge is hidden only when every chosen number is 0; a 0 next to a non-zero number is shown ("0 / 12"). Ads that still wait for the AI are never counted.
- No Setup is needed for this update.

## [0.16.8] - 2026-10-14

- The checkboxes "Content by AI" (documents) and "Answer by AI" (questions) of an application now queue the AI task only when you click the checkbox itself. Clicking their text no longer ticks them, so a stray click next to the box cannot start an AI task.
- No Setup is needed for this update.

## [0.16.7] - 2026-10-14

- New optional field "Salary I ask for" (free text, for example "75 000 CZK / month") in the window "Create application". The application detail shows it right next to the AI salary; double-click it to change it (Enter or leaving the field saves, Esc cancels, Enter on the focused text also opens it). Applications created without that window (from Add job or "Prepare with AI") start with it empty and you fill it by double-click. It is not shown in the lists or on the Kanban board.
- "Download PDF" in the Documents tab now looks and sizes like the button "Export PDF" beside it, so the two no longer look like separate kinds of elements (it is still a link to the download).
- **Run Setup after the update** (Settings > General > Run setup): the sheet Applications gets the column salary. The red "!" by Settings shows until Setup has run, and until then the application screens fail with a missing-column error.

## [0.16.6] - 2026-10-14

- "Download PDF" in the Documents tab saves the PDF to your computer with one click (Google Drive's direct download) instead of opening the Drive viewer. The download runs in the window of the app itself, so no extra tab is opened. It needs the Google account of your Drive to be signed in in the browser. "Export PDF" has a file icon, so it is no longer mistaken for the download.
- "Export PDF" no longer piles up copies: exporting a document again replaces the content and the name of the PDF that is already in the folder of the application, so there is always one file and its link stays the same. If that file was deleted or is in the trash, a new one is made. The button waits while the export runs, so a double click does not start two.
- No Setup is needed for this update. If pressing "Download PDF" opens a page of Google instead of saving the file (for example when several Google accounts are signed in), tell the author.

## [0.16.5] - 2026-10-14

- The search box of Jobs also looks in the work mode, and the search box of Applications now looks in the place and the work mode of the job as well (besides the label, the job title and the company). Type Remote or Hybrid (in a Czech interface also Na dálku or Hybridně).
- No Setup is needed for this update.

## [0.16.4] - 2026-10-14

- A job has two new checkboxes, Remote and Hybrid, that are always shown and can be ticked in the job detail, in the application detail (both change the same job) and in the review form of Add job. A click in a detail is saved at once. The list of jobs shows the ticked ones in the facts line. They replace the old Work mode value (yes / no / hybrid), which was shown only when the ad stated it.
- Portals that state a work mode tick the boxes when the ad is read; the AI prompts fill the new columns `is_remote` and `is_hybrid` instead of `remote`. "Refresh the ad" never changes the boxes.
- **Run Setup after the update** (Settings > General > Run setup): the sheet Jobs gets the columns is_remote and is_hybrid, and the old Work mode of your existing jobs is carried over once (yes = Remote, hybrid = Hybrid). Until then the Jobs screens fail with a missing-columns error. The red "!" by Settings shows until Setup has run. The old `remote` column stays in the sheet and can be deleted by hand later.

## [0.16.3] - 2026-10-14

- Add job: the checkbox "Create AI job to import" is now always shown under the link, not only after a failed download. Ticked, the button becomes "Create AI job" and the AI reads the ad itself, fills in the job and evaluates the match, without the app downloading the page first. Use it for sites whose ad text the app cannot read.
- No Setup is needed for this update.

## [0.16.2] - 2026-10-14

- A job that has no application can now be deleted, whatever its status: with the trash icon on its card in Jobs, with the trash icon under the status in its detail, or with the red "Delete job" button at the bottom of its detail. A job that has an application cannot be deleted; delete the application first. Companies stay.
- The window can also move the folder with the saved ad to the Drive trash. That happens only when the folder holds nothing but saved ads and no other job uses it; otherwise the folder stays and a notice says why. The job is deleted in every case.
- Fix: a folder that is in the Drive trash is no longer reused when the app saves an ad or creates an application; a new folder is made instead (before, the new files could end up in the trash and be lost after about 30 days).
- The Help texts about the job card and the job detail mention the delete icon.
- No Setup is needed for this update.

## [0.16.1] - 2026-10-14

- Every Kanban column has a menu by its name to sort its cards by match score, date created or salary, and for the columns after Draft also by date sent, and for Waiting by days waiting; an arrow button reverses the order. "Manual" is the order you set by dragging and is kept: while a column is sorted by a field, dragging inside it is off (moving a card in from another column still changes its status), and choosing Manual brings your own order back. Cards without a value are always last.
- The list of applications has one sort menu with all the options and a reverse button.
- Every card and list row now shows the match score and the salary of the ad ("No match yet" / "No salary" when it has none); when sorted by date created, date sent or days waiting, a line shows that value. The salary sort uses the maximum of the ad as a monthly amount.
- The explanation of the sort ("Ordered by the field. Dragging inside this column is off; choose Manual to get your own order back.") shows when you hover over the sort menu, so it takes no room in the column.
- The sort of each column and of the list is remembered.
- No Setup is needed for this update.

## [0.16.0] - 2026-10-13

- Every entry of an application's Timeline now has a round coloured icon (a flag for a status change, the icon of the channel for a message, a calendar for a meeting, a task sheet for homework, a check for a confirmation, a file or download for documents and PDFs, a bell for reminders) and a small arrow showing whether it came to you or went from you. The filter chips carry the same icons.
- New entry types in the Communication tab: Meeting (an interview or call; it may be in the future and then shows as "upcoming"), Homework (received or submitted) and Confirmation (the employer confirmed that they received your application; it also fills the date the application was sent when that is empty). Choose the type first in the Add entry window; the other fields adapt to it. Entries added before this version are shown as messages.
- New channel: Video call.
- The Communications sheet gets a new column, kind. Run "Setup" after the update (Settings > General > Run setup); until then the Communication tab and the timeline cannot be read.

## [0.15.5] - 2026-10-13

- When adding several links ends, a block says so: green "Done: all 5 ads are saved", or orange with the exact numbers ("Done: 3 saved, 1 sent to the AI, 1 failed") when something was not saved, or "Stopped: 2 of 5 links processed." when you stopped it. It replaces the small summary line below the results, the page scrolls to it, and it has the buttons Close (closes the whole Add a job window), AI tasks (when ads were sent to the AI) and Add more (empties the links).

## [0.15.4] - 2026-10-13

- Adding several links shows that the app is working: from the moment you press "Add all" a block shows a turning wheel and the pulsing text "Processing ad 2 of 5…", a progress bar and the link being read; the button turns into "Adding…" and is disabled, a line under the results says it is waiting for the page, and everything disappears when the batch ends or is stopped. The wheel and the pulsing stop when the system asks for fewer animations.
- On a job card the checkbox that asks the AI to evaluate the match has a visible label ("Evaluate match") like the other one, and its hover text explains why it is disabled when your experience is not described yet.

## [0.15.3] - 2026-10-13

- Jobs.cz parser: an ad with several places of work now keeps all of them (for example "Brno, Olomouc"; the page shows each place twice, it is listed once), and the salary is read from the salary block that Jobs.cz now shows above the facts (for example 100 000 – 140 000 Kč per month), besides the older "Mzda" item. Refresh an ad that was saved before to get both.

## [0.15.2] - 2026-10-13

- The History button now also covers the AI prompts and the texts that mean an ad is gone. Each of the seven prompts has a history of its own (its built-in text is the first version), shown by a button next to Save for the prompt on the open tab; "Reset all to default" is recorded in the history of every prompt it changed, with the source "Reset to default". The offline texts have a History button on the Availability tab. Use This on one prompt keeps what you typed and did not save in the other prompts.
- When a save is refused because a history is full, the message names the text, for example the prompt, so you know where to make room.
- The Help screen and the README describe where the History button is.

## [0.15.1] - 2026-10-13

- History of texts shows what changes: when you select an older version, the right column opens on a new Changes tab that compares it with the current text. Lines that disappear from the current text are red, lines that appear when you use the version are green, and inside a changed line only the changed words are marked. A summary gives the number of added and removed lines, long runs of equal lines are folded (one button shows them), and the Text tab still shows the whole text. The current version has nothing to compare with and shows its text.
- The Help screen (topic Settings) explains the history of texts and the comparison.
- The README says that the AI is optional and needs no API key or vendor (tried with Claude.ai and Google AI Studio), mentions other documents such as an interview preparation, and describes the history of texts and the comparison.

## [0.15.0] - 2026-10-13

- History of texts: every saved change of your experience is kept as a version. The new History button next to Save opens a window with the versions on the left (date, source, comment, pin) and the text of the selected one on the right. A version can have a comment and can be pinned; "Use This" restores it (after a confirmation) as a new version, so nothing is lost. The first version (the text before your first change) is always kept.
- Saving without a change creates no version. Pinned versions and the first version do not count towards the limit and are never deleted. The limit of unpinned versions is a new setting in General (default 50); when it is reached, saving is refused with an explanation until you delete versions in the History window.
- The history lives in a new sheet, History. Run "Setup" after the update to create it; until then the Experience text cannot be saved and the History window is empty.
- The mechanism is generic: the AI prompts and other texts will get the same History button in later releases.
- Fix: the red exclamation mark by Settings is no longer shown later than the numbers next to Jobs and AI tasks; the menu numbers wait for the setup check, so the mark comes first.

## [0.14.1] - 2026-10-13

- The Help screen has screenshots (Dashboard, Jobs, job detail, Add job, Applications, application detail, Kanban, AI tasks, Settings), each with a caption; a click on a screenshot enlarges it in a window. The screenshots are English in both languages and are part of the single-file build (JPEG, about 340 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB)(JPEG, about 58 kB).
- The Help texts were reviewed: the first steps mention the AI import and the match, the AI tasks topic mentions "Job import and match", and the tips and the first steps explain the red exclamation mark by Settings and "Run setup" after an update.

## [0.14.0] - 2026-10-13

- The README describes the application in detail (what it does, how it works, the screens with screenshots, how the AI assistant is used, where the data lives, privacy and safety, getting started and development). The screenshots are in `docs/screenshots` and show fictional data.
- The development page has a showcase mode: open it with `?demo` for a larger set of fictional jobs and applications without the "action needed" marks, or with `?demo=kanban` for the applications as a board.
- Fix: the "Detail" button of the AI tasks table no longer breaks into two lines.

## [0.13.6] - 2026-10-13

- The application detail looks like the job detail: under the title the details (company, status, match in percent, salary, work mode, location, type, AI salary) on the left, and a narrow column on the right with the status drop-down above icon buttons (open the job, the company, the ad on its website, the folder in Drive), each with a hover explanation. A new status is confirmed with a check mark (Waiting also asks for a date), a cross cancels. On a phone this column comes first. The job detail and the application detail share the same facts.

## [0.13.5] - 2026-10-13

- Add job has two checkboxes above "Save job": "Perform job match" and "Create resume and cover letter". Only one of them can be ticked (or none). Saving the job then queues the AI work at once: a match evaluation, or the application with the documents of your default set (the same as "Prepare with AI" on the card). Both need your experience described in Settings. If the AI step fails, the job stays saved.

## [0.13.4] - 2026-10-13

- When Add job cannot download an ad (LinkedIn answers HTTP 429), next to pasting the text there is the checkbox "Create AI job to import" (only while no text is pasted, and only when your experience is described in Settings). "Create AI job" saves a placeholder job and queues one AI task that reads the ad, fills in the job and evaluates your match in one go. New API method `importAiJob`, new AI task type `import_match_job`, new prompt tab "Import + match" in Settings > AI prompts. The two import prompts now tell the AI what to do when a site blocks it (HTTP 429, login wall): try the one address ONCE in the candidate's own browser through the Chrome extension, where the candidate is already signed in, and stop at any further obstacle. The longest allowed AI prompt is now 15000 characters (was 10000).

- Settings shows a red exclamation mark (in the main menu and on the tab) not only when setup has to be run but also when the built-in AI prompts changed in a new version. The tab AI prompts then has a red notice that says what to do: "Reset all to default" takes the new texts (your own edits are replaced), "Keep my prompts" keeps yours and hides the notice. New setting `ai_prompts_version`; the version of the defaults is `PROMPTS_VERSION` in the code and is raised whenever the default texts change.

## [0.13.3] - 2026-10-13

- New "Setup" card in Settings > General: the "Run setup" button runs setup (folder, spreadsheet, sheets, hourly trigger) and shows the verdict and every step in a window. Run it after every update; it never overwrites your data. New API method `runSetup`.
- The job detail summary has two columns under the title: the details on the left and a narrow column on the right with the status drop-down above a two-column grid of icon buttons (Refresh, availability check, link to the ad, Drive folder), each with a hover explanation. On a phone this column comes first.
- Profile has separate Portfolio, LinkedIn, GitHub and Personal website links; "Links" is now "Other links". Each has its own placeholder (`{{portfolio}}`, `{{linkedin}}`, `{{github}}`, `{{website}}`); `{{links}}` still works and now lists all filled links, one per line, followed by the other links. Use "Reset all to default" in Settings > AI prompts to get the new prompt wording.
- When setup has something left to create (a missing column, sheet, Profile row, Drive folder or the hourly trigger), a red exclamation mark appears by Settings in the main menu and on the Setup card; it disappears after setup ran. New API method `getSetupStatus` (read-only). Setup now also adds the missing Profile rows (the new link keys) to an existing Profile sheet. The check is remembered for the app version, so the mark is decided at once on later starts. Fix: a phone number such as "+420 ..." (or a note that starts with - or @) was stored by older versions as "=+420 ...", because Sheets puts an = in front of rich text that starts with + or -. Such text is now written as plain text, and setup gives the damaged Profile values their original text back (the red mark reports them until then). New manual checks `testSetupStatus`, `testSetupMark` and `testFormulaText`.
- "Application statuses" has two tabs, "Labels and colours" and "Allowed changes", and each AI prompt in Settings > AI prompts has its own tab.
- Fix: saving a job from Add job downloaded the ad a second time, and LinkedIn answered that with HTTP 429, so the job was saved without its stored copy of the page. The preview now hands the page it downloaded to the save, so the ad is downloaded once. `previewJob` returns `html`; `saveJob` accepts it.
- Settings > General is compact: small cards in a grid.
- Status labels, Allowed status changes and Ad statuses are now one "Statuses" tab with two sub-tabs: "Ad (job) statuses" and "Application statuses", with headings that say which statuses they are about.
- A "?" icon next to the settings that need an explanation: hover it for the description, or click or tap it to read it in a window, including the allowed values (menu refresh 0 or 5 to 3600, availability hours 0 to 23, prompt and experience length, status text length).

## [0.13.2] - 2026-10-13

- The ad parser also reads the work mode (on-site, hybrid or remote) where the page states it.
- The job detail and the job card show the salary, work mode, location and employment type of the ad.
- New Jobs column `ai_salary`: the AI fills it when it evaluates the match or writes a resume or cover letter, only when the cell is empty (format `95000 (80000-125000)`: what to ask for and the realistic monthly range). The detail and the card show it as an AI estimate. Run `setup()` to add the column to your sheet and use "Reset all to default" in Settings > AI prompts to get the new prompt text.
- The job detail has a shorter "+ Application" button on the right of the title. Under it the summary has two columns: the details on the left and a narrow column on the right with the status drop-down above a two-column grid of icon buttons (new Refresh, which re-reads the ad and updates the parsed fields while your notes, status, match and AI estimate are kept; the availability check; the link to the ad; the Drive folder), each with a hover explanation. On a phone the column goes above the details. New API method `refreshJob`.
- Fix: the Jobs list did not load when an ad had no salary (an empty number reached the browser as "undefined"). The answers of the server now travel as one JSON string (new function `apiJson`), which keeps empty values, and the formatters tolerate missing values.

## [0.13.1] - 2026-10-13

- A number next to "Applications" in the main menu shows how many applications are in draft status (hidden at zero, "99+" above 99). `getMenuCounts` now also returns `draftApplications`.
- The numbers in the main menu refresh by themselves (every minute, every 15 seconds while AI tasks are waiting, and when you return to the window), so they follow the AI's work without a reload. How often is set in Settings > General > Menu numbers (seconds, 0 turns the timed refresh off; new settings `menu_refresh_seconds` default 60 and `menu_refresh_busy_seconds` default 15).

## [0.13.0] - 2026-10-13

- Job cards without an application have a "Prepare with AI" checkbox. Ticking it creates the application and queues AI tasks for the documents of your default set (the language of the ad when it is English or Czech, otherwise the default document language); a notice names the job and the number of tasks. New API method `prepareApplication`.

## [0.12.7] - 2026-10-13

- The Jobs filter drop-downs have shorter texts ("Any", "All", "Newest", "Best match" ...), so the whole filter bar, including "Clear filters", fits one row on a 1280px screen.

## [0.12.6] - 2026-10-12

- The identifier labels (Alt+Shift+I) now cover all important elements: every button, input, drop-down, checkbox, text area, link, dialog, card, table and empty state, including the Settings, Add job, Company, Communications, Documents, Questions and Reminders forms. Existing identifiers are unchanged.

## [0.12.5] - 2026-10-12

- The "Clear filters" buttons on Jobs and Applications now look like buttons (border and background).
- The Jobs filter bar fits on one row on wide screens: narrower drop-downs, the two checkboxes stacked under each other with short texts ("Gig", "Hide with application"); the full wording shows on hover.

## [0.12.4] - 2026-10-12

- A "Clear filters" button in the filter bars of Jobs and Applications. It appears when any filter is on and resets the filters (on Jobs not the sort order; on Applications not the Kanban switch or "Hide empty columns").
- Help describes the button.

## [0.12.3] - 2026-10-12

- The Jobs screen can hide jobs that have an application (checkbox "Hide jobs with an application") and sort the list by newest, oldest, best or worst match. Jobs without a match always come last when sorting by match.
- Both choices are remembered between visits (new fields `jobs_hide_applied` and `jobs_sort` in the setting `ui_state`).
- The list is now sorted newest first by default; before it followed the order of the sheet (oldest first). Choose "Oldest first" to get the old order.
- Help describes the new controls.

## [0.12.2] - 2026-10-12

- The main menu shows counts: the number of new jobs next to "Jobs" and the number of waiting AI tasks next to "AI tasks". A count of zero is hidden; above 99 it shows 99+. On wide screens the numbers sit in one column at the right edge, on small screens they are badges on the icons.
- The green plus that opens Add job now sits right after the word "Jobs".
- Hover tooltips: the menu numbers and the plus explain themselves, and icon-only buttons (for example the availability check and the trash icon on a job card, the close cross) show their name on hover.
- API: new method `getMenuCounts` returns `newJobs` and `aiTasksWaiting`.
- Help describes the counts and the tooltips.

## [0.12.1] - 2026-10-12

- The application detail has a new first tab "Ad" with the saved text of the ad; it is preselected.
- Job detail and Add job open as pop-ups over the Jobs list. A green plus next to "Jobs" in the main menu opens Add job from any screen.
- Job cards have two columns: the card and a narrow column of icons (open the original ad, check availability, delete for jobs awaiting the AI). Jobs with no match and no application have the checkbox "Evaluate my match with AI" at the bottom right; it is disabled with a hint when no experience is saved in Settings.
- API: `listJobs` rows have `match_task_status` and `match_task_id`.
- Exported PDFs are named "Your name – Document type – Company – Job title" (the old "#1 (2026-10)" part is gone); the name comes from Settings → Profile.
- Help describes the changes.
- Fix: an ad without an evaluated match showed "Match undefined %" (the value can arrive missing). A missing match now counts as no match: the badge shows the status, and the card offers the "Evaluate my match with AI" checkbox.

## [0.12.0] - 2026-10-12

- Add several jobs at once: the new "Several links" tab of Add job takes up to 30 links, one per line. Each ad is saved by itself and a live list shows the result of every link.
- AI import: a link the app cannot read (for example LinkedIn) becomes a job with the new status "Awaiting AI" and an `import_job` AI task. The AI reads it after you tell Claude to run the pending tasks. New editable prompt "Importing a job ad from a link" in Settings → AI prompts; it is there by default and "Reset all to default" restores it.
- A job that is awaiting the AI can be deleted, also by removing its task.
- Dashboard: new card "AI tasks waiting", by task type.
- API: new methods `importJob` and `deleteJob`; `getDashboard` returns `aiTasksWaiting`.
- No new sheet columns, so running `setup()` is not needed.
- Help describes the new features.

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
