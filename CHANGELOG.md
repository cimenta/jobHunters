# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.25.2] - 2026-10-30

- New reader for **Greenhouse** job boards (job-boards.greenhouse.io, job-boards.eu.greenhouse.io and boards.greenhouse.io, links like `.../<company>/jobs/<number>`). It takes the title, the company, the place of work (an ad that says Remote is marked remote, one that says hybrid is marked hybrid), the date it was published, the application deadline, the pay range when the ad gives one (as a yearly amount) and the whole text of the ad with its headings and lists. The type of contract is not given by Greenhouse, so it stays empty. The tracking parameters `utm_*` and `gh_src` are removed from the link, and every link to one ad gets the same key, so adding the same ad twice is recognised.
- No Setup is needed for this update.

## [0.25.1] - 2026-10-30

- The popup of an e-mail has a red **Rejected** button next to the entry types. One click fills the form as a rejection (type Message, incoming, summary "Rejection from the company") and ticks **Set the status Rejected** when the status rules allow it; Save then creates the entry and rejects the application, archiving its job as the Rejection button of the Communication tab does. Clicking it again, or choosing another type, undoes it.
- No Setup is needed for this update.

## [0.25.0] - 2026-10-29

- **E-mails become communication entries.** The button **Parse e-mails** next to the filter buttons of the list of e-mails reads every new e-mail (opening a new e-mail parses it too) and suggests what it is: a Confirmation, a Meeting, a note After a meeting, a Message (a rejection, an offer or an ordinary reply) or Homework, with a confidence (high only for a clear signature), and which application, or which job without an application, it belongs to (the same conversation, the same sender as a saved e-mail, the link of the ad, the company domain, the company name and the job title; a portal such as a job board or an applicant system never counts as the company). Czech, Slovak and English wording is understood, including the rejections that StartupJobs relays and the invitations of Google Calendar, Microsoft Teams and booking pages.
- Each row of the list has an **icon in its upper left**: a bell (new), the icon of the type inside a dashed ring (suggested), the same icon in green (saved as that type) or an eye with a stroke (ignored). Opening an e-mail that is new or suggested opens a **popup with the suggestion**: a searchable list of applications and jobs without an application (suggested ones first, with the reason), the type, direction, channel, summary, time (the time a meeting names), **your notes**, a box to include the text of the e-mail in the entry, and a ticked box for the status the entry implies: **Sent** for a confirmation of a draft application, **Interview** for a meeting, **Rejected**, **Offer** or **Homework** (with its required deadline), always limited by the status rules in Settings. **Save** creates the entry, **Ignore e-mail** leaves the mail out, **Restore** brings an ignored one back. A saved e-mail links to its application or job.
- The text of the e-mail is stored in the details of the entry, so it is readable in the **Communication tab** (long text is folded, **Show more**) and in the hover card of the **timeline** (the first 1200 characters).
- Settings has a new tab **E-mails**: the **rules** that decide what an e-mail is are editable (one regular expression per line for each category, applied to lower case text without diacritics, plus the list of portal domains), with **Try it** to test a text before saving, a reset per category and for all; and the switch **Save confident suggestions automatically** (off by default): parsing then saves an e-mail by itself only when the rule is a clear one, exactly one application or job fits and the entry is a Confirmation, Meeting, After meeting or a rejection. Offers and homework are never saved automatically. New settings `email_rules` and `email_auto_save`; new API methods `parseEmails`, `parseEmail`, `getEmailDetail`, `confirmEmail`, `ignoreEmail` and `restoreEmail`.
- While a new e-mail is being read, a notice says that the window with the suggestion opens in a moment; the popup shows "Loading applications and jobs…" until its list is ready. The date and time of the entry are filled with the time the e-mail was received (in the time zone of the app) unless the text names a meeting time. The popup has a button **Show the e-mail** / **Show the suggestion** that switches the window between the suggestion and the e-mail itself (what you typed stays), and Save works in both views. Every kind of e-mail has **its own icon** in the list (new, confirmation, meeting, after a meeting, message, homework, rejection, offer, ignored), and the icon and the color of each kind can be chosen in Settings, tab E-mails, card **Icons and colors of e-mails** (remembered with the other interface settings); the icon in the list is refreshed as soon as the popup is saved. In Settings the rules are chosen with a **dropdown of categories** (one text area at a time), and the **Try it** box has a visible **Try it** button that applies the rules as they are in the form, saved or not, and also shows the job and company names it found. The direction dropdown and the "Hide bulk" checkbox of the list of e-mails are replaced by **filter buttons**: All, Incoming, Outgoing, Unprocessed (new or suggested, not saved or ignored yet) and Bulk. Next to **Emails** in the menu a number shows how many e-mails are **not parsed yet** (it disappears at zero; it refreshes with the other menu numbers and after Parse e-mails). A color chosen for an icon is applied to the saved and ignored marks too, not only to the new and suggested ones. A suggested e-mail has the button **Parse again**, for example after the rules were changed. The company is also read from a signature such as "The ACME Talent Acquisition Team" and from the name of an applicant system as the sender ("ACME @ icims").
- No Setup is needed for this update (the sheet Emails already has all its columns).

## [0.24.1] - 2026-10-26

- **Setup is needed** (once, adds the column is_contract to the sheet Jobs; the red "!" by Settings says so). Until then jobs cannot be read from the sheet.
- New checkbox **Contract only**, next to Remote and Hybrid in the detail of a job and of an application, and in Add job. A click in a detail is saved at once; a job marked so shows a **Contract only** badge on its card in the Jobs list.
- The Help line about the editable salary of an ad, added in 0.24.0, is now listed in the Help screen.

## [0.24.0] - 2026-10-26

- New **Refresh data** button (a circular arrow) next to the title JobHunters in the menu; on a narrow screen, where the title is not shown, it sits at the top right of the page. One click reads the data again: the screen you are on, the menu numbers, the settings and the Setup check. The arrow spins while it works and a notice says when it is done; what you are typing and open pop-ups stay as they are. The shortcut **Alt+Shift+R** does the same from anywhere, also while a pop-up covers the button (the pop-up's own data is refreshed too).
- The **salary of the ad** (from, to, currency, per) is now always shown in the detail of a job and of an application, also when it is empty, and can be changed in place: double-click it or use the pencil, Enter saves, Escape cancels, empty amounts clear it. Numbers only, and the minimum cannot be above the maximum. New API fields `salary_min`, `salary_max`, `salary_currency` and `salary_period` (text) in `updateJob`.
- No Setup is needed for this update.

## [0.23.2] - 2026-10-26

- Adding a communication entry of type **Meeting** offers **Set the status Interview** (ticked; untick it to only record the entry), for both an invitation by the employer and a meeting you arranged. It is not offered when editing an entry, when the application is already in Interview, or when the status rules in Settings do not allow the move. The status changes after the entry is saved.
- No Setup is needed for this update.

## [0.23.1] - 2026-10-25

- Setting a job to **No** (in its detail, or with the No icon on its card in the Jobs list) asks what to do with its applications that are still open: **Withdraw them** sets them to Withdrawn and the job to No, **Keep them as they are** sets only the job, **Cancel** changes nothing. Applications already Rejected, Withdrawn or Ghosted, and those that the status rules in Settings do not allow to move to Withdrawn, are not listed. A job without open applications gets the status at once, as before.
- No Setup is needed for this update.

## [0.23.0] - 2026-10-24

- **Setup is needed** (once, adds the column gig_priority to the sheet Jobs; the red "!" by Settings says so). Until then jobs cannot be read from the sheet.
- A gig can be marked **High priority**: a checkbox that appears while Gig is ticked, in Add job and in the detail of a job. A gig with high priority shows a red badge on its card and in its detail; unticking Gig clears the priority.
- While the Jobs filter is **Gigs only**, the Sort by list also offers **Priority (high first)**: high-priority gigs come first, the others follow, newest first in both groups. With another filter the choice is not offered and the list falls back to Newest.

## [0.22.0] - 2026-10-24

- The Dashboard can be arranged by the user. The new menu **⋯** in the upper right (next to Add a job) has **Edit layout**: the sections (Reminders, AI tasks waiting, Applications by status) become widgets that can be **moved** (drag the title, or arrow keys on it), **resized** (drag the corner, or Shift and arrow keys) on a 12-column grid, **removed** and **added back** from the Add a widget list. Widgets pushed by another one move down; the layout is **saved automatically** and Reset to default brings the original one back. On narrow screens the widgets are stacked. New field `dashboard_layout` in the interface settings.
- No Setup is needed for this update.

## [0.21.0] - 2026-10-24

- The Dashboard card **Applications by status** has the **Gigs only / No gigs** switch of the Jobs screen (click a button to select it, click it again to show all) and a **Total** badge next to its title; both follow the switch. The choice is remembered with the other interface settings, separately from the Jobs screen. New field `gigStatusCounts` in the API method `getDashboard`.
- No Setup is needed for this update.

## [0.20.3] - 2026-10-24

- **Setup is needed** (once, puts the new status Homework and the reminder source homework into the dropdown lists of the sheets Applications and Reminders; the red "!" says so). Until then the sheet marks a Homework application as an invalid value.
- New application status **Homework** (Domácí úkol), between Interview and Offer in the list, the Kanban board, Settings (colors and allowed changes) and the Dashboard. Moving an application to it by hand (the status menu, a Kanban drag or the "Move to" menu) asks for the **deadline**, like Waiting asks for the reminder date; the deadline becomes a reminder "Homework due" and is closed when the status is left. Entering Homework again moves the deadline. By default Sent, Waiting, Interview, Offer and Ghosted can go to Homework, and Homework can go to Waiting, Interview, Offer, Rejected, Ghosted and Withdrawn; Settings can change this like the other rules.
- Adding a communication entry of type Homework that you **received** offers "Set the status Homework" (ticked) with a **required deadline**: the entry cannot be saved without it, unless you untick the status. A submitted homework needs no deadline and does not change the status.
- The Calendar shows a new event type, **Homework deadline** (a purple chip with a task icon on the day of the deadline, red once it has passed), with its own color in Settings, Calendar colors. New field `homeworks` in the API method `getCalendar`.

## [0.20.2] - 2026-10-24

- New setting **Show the Rejected icon on application cards in the Kanban board** (Settings, card Kanban; off by default, remembered with the other interface settings). With it on, cards that may move to Rejected get a red icon next to Ghosted and Withdrawn. One click opens a small dialog with the channel (E-mail), the time (now) and an optional note filled in; confirming adds an incoming message "Rejection from the company" to the communication of the application, sets the application to Rejected and archives its job (a new or applied one, as with every rejection; a job set to No or to an own status stays as it is).
- No Setup is needed for this update.

## [0.20.1] - 2026-10-24

- **Calendar colors**: Settings has a new card, **Calendar colors**, with a color picker for the background of the three kinds of entries in the Calendar (Interview, Waiting, Waiting with the reminder date passed). The text on them turns black or white by itself so it stays readable. **Reset to defaults** brings the colors of the theme back; a color left at its default is stored as "no choice", so the dark theme keeps its own. The choice is remembered with the other interface settings.
- No Setup is needed for this update.

## [0.20.0] - 2026-10-24

- New menu item **Calendar** (between Companies and Emails): the whole month on one page, weeks starting on Monday, with the days of the neighbouring months dimmed. The arrows move a month, **Today** comes back to the current one.
- **Interviews** are shown as chips on their day (time, an icon of the channel and the company): every communication entry of kind meeting, of an application or of a job without one. Past ones are faded. A click opens the application (or the job).
- **Waitings** are bars across the weeks, from the day the application went to the status Waiting to the day of its reminder; amber while the reminder is ahead, red once its date has passed (the bell marks that day), and running to today when there is no reminder. A click opens the application.
- Days are cut in the time zone of the script, like every other time in the app. New API method `getCalendar`; the Help has a Calendar topic.
- No Setup is needed for this update.

## [0.19.4] - 2026-10-24

- Two ads on one career page are no longer taken for the same ad: for cesnet.cz the part of the address after # (for example `#analytik-medior`) is kept in the stored link and in the duplicate check. The addresses of other sites are cleaned of it as before.
- New reader for the career page of CESNET (cesnet.cz/kariera): from the page with all open positions it takes the one named by the anchor of the link (title, place, text). The page is behind a "not a bot" check, so paste its source code into Add job together with the link.
- No Setup is needed for this update.

## [0.19.3] - 2026-10-24

- **Setup is needed** (once, adds the column `job_id` to the sheet Communications; the red "!" says so). Until then the new tabs cannot save entries.
- The detail of a job has two new tabs, **Timeline** and **Communication**, because a gig often never gets an application. Communication holds entries kept on the job itself (add, edit and delete them there; no application is needed) and, read only with a link to the application, the entries of its applications. Timeline merges the events of all applications of the job (status changes, messages, meetings, documents, reminders) with the entries of the job, with the same type filters and order button as in an application; a small mark on each event says whether it belongs to the job or to which application. Deleting a job deletes the entries kept on it.
- The filter **Gig** in the list of jobs is now a small two-button switch, **Gigs only** and **No gigs** (nothing selected = all jobs; click the selected one again to unselect it), instead of a checkbox. The choice is remembered, like the Hide checkboxes, and "Clear filters" resets it.
- **Hide no** also hides the jobs with the status Archived (its hover text says so).
- The button **Clear filters** moved from the filter bar to the title row, in front of **Add job**.
- Fixed the Help: the text about portals behind a Cloudflare check had the same key as the text about deleting a job, so one of them was missing.

## [0.19.2] - 2026-10-24

- New readers for two more job portals. **Manpower** (manpower.cz, `/nabidky-prace/<name>--<number>/`) reads the page itself, because its structured data is broken and names the head office: the title, the contract and the place from the two labels under the heading, the date the ad was put in, and the text of the ad (the introduction and the blocks Popis pozice, Požadujeme, Nabízíme) without the closing notice about men and women. The box on the left adds the field (Obor) and the benefits (Benefity) to the text, and the recruiter named there (name, phone, e-mail) is filled in as the contact person of the job. The pay is taken from the text of the ad when a line about the wage names an amount in crowns ("Mzdu až 45 000 Kč" is a monthly upper limit, "od" a lower one). **Flek** (flek.cz, `/nabidka/<name>/<number>/`) uses the structured data of the page and adds the place as the city without the country code, the contract from the summary box, the gig mark and the text without the same notice.
- Pictures (emoji) and invisible characters are now removed from the titles and texts read from Fajn Brigády, Inwork, Nelisa, Manpower and Flek, and a pay written as "Kč/h" is an hourly pay (Fajn Brigády showed "200 - 200 Kč/h" without a period).
- Links of both portals are cleaned of tracking parameters and every link to one ad gets the same key, so adding the same ad twice is recognised. Fajn Brigády still blocks programs with a check page; if Add job reports that the page cannot be read, paste the source code (or the copied page) instead.
- No Setup is needed for this update.

## [0.19.1] - 2026-10-24

- The detail of a job has a checkbox **Gig** (in the facts, next to Remote and Hybrid, under "Kind of work") so a job can be marked as a gig, or the mark taken off, with one click. It is saved at once (if the save fails, the box goes back and the error is shown). Ticking it adds the field **Shift**, as before. The box of the Notes tab is the same value and stays in step with it.
- No Setup is needed for this update.

## [0.19.0] - 2026-10-23

- New readers for six more job portals. **Fajn Brigády** (fajn-brigady.cz) and **Inwork** (inwork.cz) share one reader: it takes the title, the company, the place of work, the wage (a wage per task is kept as an amount with no period, not called monthly), the type of contract, the date the ad was put in and the whole text of the ad. Every ad of Fajn Brigády is a gig. **GigaPráce** (gigaprace.cz) uses the structured data of the page, and the reader only gives the place of work as the city without the country code. **Jooble** (cz.jooble.org) has a reader of its own for the ad inside its page (title without the kind of the ad, hourly or monthly pay, contract types, company, region, the whole text, gig); every link to one Jooble ad has the same key. **Správný krok** (spravnykrok.cz) has a reader of its own too, for a page without structured data: title, company, place, pay (monthly or hourly), contract, the text between the two answer buttons and a gig mark; the contact person of the ad is left out. **Nelisa** (nelisa.com, the offers of employers at `<company>.nelisa.com/cs/offer/...`) has one too: the page has no structured data, so it reads the headline (without pictures and the closing pay, because the page has no separate position name, so check the title), the company, the place, "od 36 000 Kč měsíčně" as a monthly lower limit, the type of work and the text of the ad.
- When a page cannot be downloaded or read, Add job now says so with the choice it offers: the message, the button and the field all say "text or HTML" (the text of the ad or the HTML source code of the page), not only "text".
- The links of these portals are cleaned of the entry parameter `vstup` (as in `?vstup=jooble&utm_...`), and every link to one ad gets the same key, so adding the same ad twice is recognised.
- Fajn Brigády, Inwork and **Jooble** sit behind a Cloudflare check and answer the app (like any program) with HTTP 403, so the readers help only where the page arrives, or where you paste it (see the next point). The other ways out stay as they were (paste the text, or "Create AI job to import", where the AI opens the page in your browser), and Help explains it. A Jooble link only leads to the ad of another site, so use the link of the original ad when you can; the Jooble reader is for when you paste what you copied from the page.
- **Paste the source code of a page.** The paste box of Add job (the one that opens when a page cannot be downloaded) now also takes the source code of the page: open the page in your browser, right-click, View page source, select all, copy, and paste it there. It can also be only a piece of the page copied in the browser tools (right-click the ad, Inspect, right-click the element, Copy, Copy outerHTML), which is how Jooble ads are best taken. The app then reads it like a downloaded page, so the reader of the portal works even where the app is refused: the title, the company, the place, the wage and the text come out as if it had been downloaded. For a site without a reader, the visible text of the source fills what the page does not give. The source is saved as the snapshot of the ad. Plain text pasted there works as before.
- No Setup is needed for this update.

## [0.18.1] - 2026-10-23

- The prompts for the **resume** and the **cover letter** now also evaluate the job match, so there is no need to ask for a separate "Evaluate match" task when you go straight to an application. The new step runs **only while the match of the job is empty**: an existing evaluation is never overwritten. It also fills Remote, Hybrid and the contact person of the job from the ad (only empty cells), exactly like the match task. The evaluation is written in the language of the app, not of the document.
- The evaluation text is now kept **on the job** (new column match_note in the sheet Jobs), next to the percentage, by whichever task made it: the match task, the import-and-match task, the resume or the cover letter. The button **Match** of an application and the tab **Match** of a job show that text; an older evaluation that is only in the note of a match task is still shown when the job has no text of its own. The search finds words in it.
- The built-in prompts changed (their version went up), so the red "!" by Settings asks you to press **Reset all to default** in Settings > AI prompts; your own versions stay in the history of each prompt. Until you do, the AI keeps using your old prompts, which still work but do not write match_note.
- **Run Setup after the update** (Settings > General > Run setup): it adds the column match_note to the sheet Jobs. The red "!" by Settings shows until it ran.

## [0.18.0] - 2026-10-22

- New **search** at the top of the main menu, above Dashboard (on a narrow screen an icon that opens it). It looks through companies, jobs, applications, e-mails and AI tasks at once: titles and names, places, contact persons, the reason why not, notes, the text of the ads, the interview preparation, the whole text of the e-mails and the notes the AI wrote. Type at least two characters; the search starts after a short pause, case and diacritics do not matter, and every word must be found in the same item.
- The results open in a pop-up, grouped by type, and every row has a mark saying what it is (**Company**, **Job**, **Application**, **Email**, **AI task**), so a company that has jobs and an application shows each of them as its own row and you choose which to open. A match is drawn in bold, and when it is not in the title a piece of the text around it is shown. A group shows five rows with a link "Show all N" that lists up to fifty; a click on a row opens the company, the job, the application or the e-mail (an AI task opens the list of tasks).
- Keyboard: **/** (when you are not typing in a field) and **Ctrl+K** (Cmd+K on a Mac) jump to the search box; the arrow keys choose a row, Enter opens it and Esc closes the pop-up. A click anywhere else closes it too.
- The search runs on the server in one call, and reads only the sheets it needs; without the sheet Emails the other groups still work. Help has a new tab Search.
- No Setup is needed for this update.

## [0.17.7] - 2026-10-21

- Every card in the list of **Jobs** has two new icons, **Archive** and **No**, in a second column of icons. One click sets that status of the ad at once (no question; a message says what changed). The icon of the status the ad already has is left out, and an ad that waits for the AI has none. The names in the tooltips follow the names you gave the statuses in Settings.
- Every card of the **Kanban board** has two icons next to the "Move to" menu, which is narrower now: **Ghosted** and **Withdrawn**. One click moves the application there at once (to the top of that column), but only when your status rules allow that move from its current status, so for example a rejected card has none. Withdrawing archives the job as before; the reason for it can be typed in the detail of the application.
- No Setup is needed for this update.

## [0.17.6] - 2026-10-20

- New tab **Interview** in the detail of an application (after Communication): a text box for your preparation for the interview, with a **Save** button and a note "Unsaved changes" while the text differs from the saved one.
- The text has a limit of **49,000 characters**, what a cell of the sheet can hold, so anything you can type can also be saved. A counter shows how much is used (it turns to a warning near the limit), the box takes no more text at the limit, a longer paste is cut and a notice says so. The server refuses a longer text as well, and never cuts it.
- The text is **Markdown**, in a simple editor: a toolbar (bold, italic, heading, list, link, code; Ctrl+B and Ctrl+I work too) and the buttons **Edit** and **Preview**. The preview shows headings, bold, italic, lists, quotes, code, rules and http(s) links. It never uses HTML: the typed text is turned into a tree and drawn with ordinary elements, so raw HTML (`<script>`, `<img onerror=...>`) is shown as text and a link that is not http or https stays text. The limit counts the Markdown you typed.
- The lists of applications do not carry this text, only the detail does.
- **Run Setup after the update** (Settings > General > Run setup): it adds the column interview_prep to the sheet Applications. The red "!" by Settings shows until it ran; without it the text cannot be saved.

## [0.17.5] - 2026-10-17

- Changing an application to **Withdrawn** now behaves like Rejected for its job: a New or Applied job becomes Archived (No and your own statuses stay as they are). This also holds when you drag the card to the Withdrawn column of the Kanban board.
- Right after you confirm the status **Withdrawn**, the field **Reason why not** opens in the detail of the application, the same way it opens after you set a job to No. It is the same field as on the job (it is stored on the job), so the reason is also shown in the detail of the job. The field is also shown for a withdrawn application and whenever the job already has a reason.
- No Setup is needed for this update.

## [0.17.4] - 2026-10-16

- A double-click on the **Location** of a job changes it in place, in the detail of a job and in the detail of an application (Enter or leaving the field saves, Esc cancels). It works the same way as the contact person. The Location is now always listed in the facts, so an empty one can be filled in: it shows "Double-click to add". A job that waits for the AI keeps its location as plain text.
- No Setup is needed for this update.

## [0.17.3] - 2026-10-16

- The detail of an application shows the AI match text. On the tab **Ad** there is a button **Match** in the top right corner (it shows the percentage when the AI has evaluated the job, for example "Match 82 %"); it opens a window with the percentage and the text the AI wrote, with its line breaks. When there is no text yet the window says what state the AI task is in (waiting, working, failed, needs input), and when no evaluation was ever asked for it says where to ask (the tab Match of the job). The button is only on the tab Ad.
- No Setup is needed for this update.

## [0.17.2] - 2026-10-16

- New menu item **Emails** (between Companies and AI tasks): a read-only viewer of the mail that a separate script copies from your mailbox into the sheet Emails. The list shows the newest first, who it is with (the sender of an incoming mail, the first recipient of an outgoing one), the subject, the date in your time zone, the number of attachments and a mark "bulk" for newsletters and other bulk mail. A search box looks in the sender, the subject, the attachment names and the start of the text; a menu filters incoming or outgoing mail, and "Hide bulk" hides bulk mail.
- A click opens the whole e-mail: sender, recipients, copy, date, the names of the attachments and the text with its line breaks. Nothing can be changed here yet.
- The list does not carry the body of the e-mails (only a short excerpt to search in), so it stays fast while the sheet grows. Without the sheet Emails the screen shows the usual "sheet is missing" message and the rest of the app works.
- Help has a new tab **Emails**. No Setup is needed for this update (the sheet comes from 0.17.0).

## [0.17.1] - 2026-10-16

- The step **Check the details** of Add job has a new field **Contact person** (next to Location). It is optional and is saved with the job, in the same place the job detail already shows it.
- When you tick **Gig** in that step, a block **Gig details** appears with a free-text field **Shift** (for example "Sat-Sun 8-16"); more gig fields can follow later. Un-ticking Gig drops the text. The job detail shows the same field **Shift** for a gig, and a double-click changes it.
- **Run Setup after the update** (Settings > General > Run setup): it adds the column gig_shift to the sheet Jobs. The red "!" by Settings shows until it ran; without it the shift cannot be saved.

## [0.17.0] - 2026-10-16

- New sheet **Emails** for mail from the mailbox. A separate script only appends rows to it (id, thread, date, direction, sender, recipients, subject, body, attachment names and a bulk-mail flag); the app will fill the other columns (type, confidence, signals, matched job and application, state). Nothing in the screens uses it yet: this release only prepares the sheet.
- **Run Setup after the update** (Settings > General > Run setup): it creates the sheet Emails with its dropdown lists and a checkbox column. The red "!" by Settings shows until it ran.

## [0.16.15] - 2026-10-16

- New communication type **After meeting** (right after Meeting in the type list and in the timeline filters, with its own icon). It is your own note on how a meeting went: it has no direction and no channel in the window (the data keeps the direction "note" and an empty channel), and its summary is called "How the meeting went".
- Under that type the window has a checkbox **Set the status Waiting**. Ticking it shows the date "Remind me on" (7 days from today at first, not in the past, required); after the entry is saved the application moves to Waiting with that reminder. It is shown only when the status can move to Waiting under your rules (or the application already waits, then the reminder moves).
- The **Rejection** button has no cross any more, only the text. Picking another type than Message switches the rejection off.
- **Run Setup after the update** (Settings > General > Run setup): it puts the new type into the dropdown list of the sheet Communications. The red "!" by Settings shows until it ran. The app works without it, but the sheet would flag the new value.

## [0.16.14] - 2026-10-16

- The summary of a communication entry is no longer required. The field says "(optional)", Save is always enabled, and an entry with only details or nothing at all is allowed. The timeline shows such an entry as "Incoming · E-mail" (or "Meeting") without a dangling colon.
- The window "Add entry" has a small light red button **Rejection** next to its title. It fills the form for a rejection (type Message, direction Incoming, summary "Rejection from the company") and, **after you save the entry**, sets the status of the application to Rejected. Press it again to undo the fill. It is not shown when the status cannot move to Rejected under your rules (for example a Draft) or when you edit an entry.
- In the timeline, hovering (or focusing with the keyboard) the icon of a communication entry shows its summary and details.
- No Setup is needed for this update.

## [0.16.13] - 2026-10-15

- Fix: Setup put the formats of the sheet columns (plain text, checkboxes, dropdown lists) on the columns of an OLD sheet by their number in the template, not by their name. Since 0.16.4 that put checkboxes on `posted_at` and `valid_until` of the sheet Jobs (their empty cells showed FALSE) and left `is_remote` and `is_hybrid` without them, and shifted the other formats of that sheet by two columns. Setup now finds every column by its name in the first row of the sheet, and puts the old mistake right once: it takes the checkboxes off the date columns, turns their FALSE back into empty cells, and sets the checkboxes and dropdown lists on the right columns. No data of yours changes except those FALSE cells.
- **Run Setup after the update** (Settings > General > Run setup). The red "!" by Settings shows until it ran.
- Settings > General has a new card **Test data** with two buttons: "Create test job" and "Create test job + application". They make the company "test" (reused) and a job "test", "test 2"... with no link and the status New; the second also makes a real application (Drive folder, documents from your templates). Delete them like any other data.
- The badge "PDF is out of date" of a document has a tooltip: the Google Doc was edited after the PDF was exported, so the PDF may no longer match it; press Export PDF to create it again.

## [0.16.12] - 2026-10-15

- Two new built-in statuses of an ad: **Applied** and **Archived**. Creating an application for a New job makes it Applied (an Archived job becomes Applied again when you apply again); an application that moves to Rejected makes its job Archived. A job with the status No or a status of your own stays as it is, and nothing moves back by itself: set a job to New by hand when you want it there. The new statuses are not checked for availability. The count of new jobs in the menu now counts only jobs that are really New.
- **Setup moves the ads that already have an application** from New to Applied once (to Archived when their latest application is rejected). Run Setup after the update (Settings > General > Run setup). The red "!" by Settings says how many ads wait for it. It runs only once, so a later Setup never undoes a status you set by hand.
- A job without a link (for example an imported one) shows a **red icon** instead of the icon that opens the ad, on its card, in its detail and in the detail of its application. A click opens a window where you add the link; a link that is not a web address, or that another job already has, is refused with the name of the other job. Refresh and the availability check are off for a job without a link, the scheduled check skips it, and the detail of a job has a field **Link** that a double-click changes.
- Prepares the import of old jobs and applications (no import is part of the app).

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
