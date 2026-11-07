# BrainPulses: Registration Flow

## 1. Purpose, scope and reference build

This spec covers the admin-side **registration flow** of BrainPulses, from the Students page to a saved, shareable registration form:

- the admin shell (left sidebar),
- the **Students** page with **Create registration form**,
- **Step 1: Registration Form** (sponsor, contest, dates, seats, header, fields, live preview),
- **Step 2: Assignment Rules** (link, quizzes, who can register, Registration ID rules),
- the read-only **form view page**, **Give a quiz**, and **Edit form** (admin password).

Reference build: **BrainPulses-registration-flow.html** (one clickable file; sample data). Where this spec and the build differ, this spec wins. Items marked \[Proposed\] are suggestions not yet confirmed.

Out of scope here: the Participants page (list, add one or in bulk), Reports & Results, the participant portal itself, and quiz creation.

## 2. Key decisions

- **A registration form belongs to a contest**, not a quiz. **One registration form per contest** for now: a contest that already has a form can't be picked again.
- **Sponsor first, then contest.** The contest list shows only that sponsor's contests.
- **Quizzes are given to the form**, now or later. The link can be shared before any quiz exists.
- A participant sees **only the quizzes given to the form they registered through** (or given to them by an admin).
- **Anyone with the link can register.** There is no invite mode. An optional email-domain restriction exists.
- **Registration ID = BP + 8 digits** (e.g. BP48210937), unique across BrainPulses, and the **only login**. Mobile number is a contact detail only (no login, no one-time code) for now.
- **Returning participants** keep their existing ID by default. The match rule is chosen per form: **First name AND (Email OR Mobile)** (default) or **Email OR Mobile**.
- **Four locked fields** (First name, Last name, Email, Mobile number) need the **admin login password** to unlock.
- A saved form opens **read-only**. **Editing needs the admin login password.** Giving a quiz does not.

## 3. Admin shell: left sidebar

Same sidebar as the admin prototype.

- **Top:** BrainPulses logo and name, and a **collapse** button.
- **Label:** QUIZ MODULE.
- **Items:** Dashboard, Sponsors, Contests, **Students** (current page, highlighted), then two groups that fold open and closed with an arrow:
  - **QUIZZES:** All Quizzes, Question Banks, Reports & Results.
  - **SETTINGS:** Users, User & Access.
- **Bottom:** profile card (initials, name, role) with a **sun/moon** button that switches light and dark mode for the whole page, including both steps.
- **Remembered per admin:** collapsed or open sidebar, which groups are folded, and the theme.

| Screen | Behaviour |
| --- | --- |
| Desktop (wider than 860 px) | Sidebar on the left. The collapse button hides it; a small button at the top left opens it again. |
| Phone and small tablet (860 px or less) | A top bar with ☰ and the BrainPulses name. ☰ slides the sidebar in from the left over a dimmed page. It closes with ✕, by tapping outside it, with Esc, or when a menu item is chosen. **The sidebar never moves to the top of the page.** |

## 4. Participants page

- **Header:** breadcrumb "BrainPulses / Participants", title **Participants**, line "One row per participant per contest. Students join a contest through its registration form." On the right: **+ Create registration form** (primary button).
- **KPI cards:**

| Card | Counts |
| --- | --- |
| Registration forms | All saved forms |
| Live links | Forms whose link is switched on |
| Participants | All registered participants |
| Forms with no quiz yet | Forms with no quiz given |

### Registration forms list

Sub-line: "One per contest. Open a form to see it, give a quiz, or edit it (admin password needed)." One row per form, newest first:

| Part | Shows |
| --- | --- |
| Contest | Contest name, sponsor underneath |
| Link | e.g. bp.link/code-quest-2026, with a **Copy** button (toast "Link copied") |
| Quizzes | "2 quizzes" with their names, or an amber **No quiz yet** pill |
| Actions | **+ Give a quiz** (only when no quiz yet) and **Open** |

- Clicking the row (or Enter on it) opens the **form view page** (section 8).
- A form just saved is highlighted briefly.

### Students table

Columns: Registration ID, Name, Email, Sponsor, Contest, Quizzes given, Registered (date). Header shows the count, e.g. "4 students".

## 5. Flow overview

1. Students → **Create registration form** → **Step 1, Registration Form**.
2. **Save & continue** (checks pass) → **Step 2, Assignment Rules**, carrying the sponsor, contest and registration close time.
3. **Back** (or clicking "1 Registration Form" in the stepper) returns to Step 1 with everything kept.
4. **Save registration form** → back to Students with toast "Registration form for \[contest\] saved. The link is live." (or "… The link is live; give a quiz later from the form." when no quiz was chosen).
5. Clicking **Participant****s** in the sidebar leaves the flow without saving.

The page header during the flow reads "BrainPulses / Students / Create registration form" ("Edit registration form" when editing). The stepper shows two steps: **1 Registration Form**, **2 Assignment Rules**.

## 6. Step 1: Registration Form

### 6.1 Layout

- Two columns: the **builder** card (left) and the **live preview** (right, stays in view while the builder scrolls).
- **Resize handle** between them: drag to change the preview width.
  - Preview width: minimum 340 px, default 520 px. The builder never gets narrower than 600 px.
  - Double-click resets to the default (toast "Preview size reset").
  - Keyboard: ←/→ move 20 px (Shift: 80 px), Home = widest preview, End = narrowest, Enter = default.
  - The width is remembered per admin.
- The builder's field rows adapt to the builder width: one line when wide, two lines at 600–900 px, stacked below 600 px.
- Footer: **Back** (disabled), **Save as draft**, **Save & continue**.
- Card text: "Registration Form · Step 1 of 2", intro "Participants fill this form once, when they first open the contest's link. Quizzes are given to them in the next step, now or later. The live preview shows exactly what they'll see."

### 6.2 Sponsor & contest (first section, both required)

| Setting | Behaviour |
| --- | --- |
| Sponsor | Dropdown of all sponsors ("Choose a sponsor"). Changing it clears the contest. |
| Contest | That sponsor's contests only. Disabled with "Choose a sponsor first" until a sponsor is picked. Hint: "Only \[sponsor\]'s contests are listed. One registration form per contest." |

- **One form per contest:** a contest that already has a form is listed **greyed out** as "\[Contest\] (already has a form)" and can't be picked.
- When **editing**, both dropdowns are disabled with "The sponsor and contest can't change once the form is saved."
- The contest gives the form its title, sponsor name and image.

### 6.3 Registration window & seats

| Setting | Required | Default | Rules |
| --- | --- | --- | --- |
| Registration opens | Yes | When the form is saved | Date and time (IST) |
| Registration closes | Yes | Admin picks | Must be after opening. Hint: "When a quiz is given to this form later, you're warned if it ends before registration closes." |
| Number of seats | No | Empty = unlimited | Whole number 1–100,000. Hint: "Leave empty for unlimited registrations while the form is open." |

- Summary line: "Open from \[date\] to \[date\] · \[n\] seats" (or "Unlimited seats").
- When registration isn't possible, the form is replaced under the contest header by: before opening, "Registration opens on \[date, time\]."; after closing, "Registration has closed." + Log in; seats full, "All seats are taken." + Log in. People already registered can still log in and take the quizzes given to them. (Not shown in the reference build.)

### 6.4 Form header

- **Welcome message:** optional, up to 300 characters, live count "85 / 300 characters".
- **Show on the form** (tick chips, all ticked by default):

| Chip | Shows | From |
| --- | --- | --- |
| Contest image | Banner at the top | The contest |
| Sponsor name | Sponsor logo and name | The sponsor |
| Registration closes | Closing date and time, in amber | Registration closes |
| Seats left | e.g. "200 seats left" | Number of seats. With no limit the chip is greyed out ("no limit set") and nothing shows |

- A grey box lists what comes from the contest (title, sponsor, image). The **contest name** is always the heading. Quiz details aren't shown, because quizzes are given later.

### 6.5 Form fields

**Locked fields** (always first, in this order, not draggable):

| Field | Type | Default | After unlocking, the admin can |
| --- | --- | --- | --- |
| First name | Text | Required | Change label, Required, placeholder, help, max characters; delete |
| Last name | Text | Required | Same as First name |
| Email | Email | Required | Change label, placeholder, help. **Can't be made optional or deleted** (the Registration ID is sent to it) |
| Mobile number | Phone (+91, 10 digits) | Required | Change label, Required, placeholder, help; delete |

- **Locked state:** bar "Locked fields. First name, Last name, Email and Mobile number can only be changed after unlocking with your admin password." with **Unlock to edit**. Labels are read-only; type, Required, More settings and Delete are greyed out with a lock icon.
- **Unlocking** needs the admin login password (section 11). Unlocked bar (amber): "Unlocked. You can edit these fields. They lock again when you save or press Lock again. Email always stays." with **Lock again** and **Restore \[field\]** for any deleted locked field.
- The field **type never changes** for locked fields.
- They lock again on **Lock again**, on **Save & continue**, and when the page is left.

**Admin's own fields** (under a YOUR FIELDS divider):

- Default custom fields: **Gender** (Dropdown: Male, Female, Prefer not to say; optional) and **Terms & Conditions** (consent; required).
- **+ Add field** adds "Untitled field" (Text, optional) and puts the cursor in its label. Limit: **20 extra fields** (counter "2 of 20 extra fields"; the button is disabled at 20).
- Each row: drag handle, label, type, the type's extra input, **REQUIRED** tick, **More settings** (arrow), **Delete**.
- **Drag** ⋮⋮ to reorder (or focus the handle and use ↑/↓).

| Type | Extra input on the row | More settings |
| --- | --- | --- |
| Text | — | Placeholder, Help text, Max characters (default 100, up to 250) |
| Number | — | Placeholder, Help text, Min value, Max value |
| Email | — | Placeholder, Help text |
| Phone | — | Placeholder, Help text |
| Textarea | — | Placeholder, Help text, Max characters (default 500, up to 2,000) |
| Dropdown | Options as tags | Help text |
| Multi-select | Options as tags | Help text, Min selections, Max selections |
| Terms & Conditions (consent) | Consent text (up to 300 characters) | Link to full terms |

- **Options as tags:** type an option and press Enter (or comma); paste several at once; drag tags to reorder; ✕ or Backspace removes. A duplicate is ignored with ""\[option\]" is already an option".
- **Delete** asks: "Delete "\[label\]"? Participants won't see this field any more. If anyone has already registered, their answers to it are kept on the Participants page and in downloads." (Cancel / Delete field).

### 6.6 Live preview

- Controls: **Desktop / Mobile**, **Light / Dark**, **Full preview** (opens the page full screen with the same controls).
- It shows exactly what participants see: BrainPulses logo; a card with the contest image, sponsor, contest name, welcome message, the ticked chips, the fields in order, the consent tick box, **Register**, and "Already registered? Log in".
- It is **interactive**: the admin can fill it and press Register to test the checks. Nothing is saved.
- Participant-side checks (shown under each field):

| Case | Message |
| --- | --- |
| Required field empty | "Enter your \[label\]." / "Choose your \[label\]." (dropdown) / "Pick at least one option." (multi-select) / "Please accept to continue." (consent) |
| Invalid email | "Enter a valid email, like name@example.com." |
| Invalid mobile | "Enter a 10-digit mobile number." (starts with 6–9) |
| Number outside limits | "Enter a number." / "Enter \[min\] or more." / "Enter \[max\] or less." |
| Multi-select outside limits | "Pick at least \[n\]." / "Pick up to \[n\]." |

- On a valid submit the preview shows "You're registered (preview only).", a sample ID (BP + 8 digits), "Your Registration ID. Use it to log in. Your quizzes appear after you log in. Nothing was saved." and **Back to the form**.

### 6.7 Checks on Save & continue

| Problem | Message |
| --- | --- |
| No sponsor | Choose the sponsor. |
| No contest | Choose the contest. (or "Choose a sponsor first, then the contest.") |
| Registration opens / closes empty | Choose when registration opens. / Choose when registration closes. |
| Closes at or before it opens | Closing time must be after the opening time. |
| Seats not 1–100,000 | Enter a whole number from 1 to 100,000, or leave it empty for unlimited. |
| Empty label | Add a label for this field. |
| Duplicate label (any case, locked included) | Another field is already called "\[label\]". Use a different label. |
| Dropdown / Multi-select with fewer than 2 options | Add at least 2 options. |
| Consent with no text | Add the consent text participants will agree to. |
| Number min above max | Min value can't be more than max value. |
| Multi-select min above max | Min selections can't be more than max selections. |
| Multi-select max above number of options | Max selections can't be more than the number of options. |

- With errors: a red banner "Fix \[n\] fields before continuing. They are marked in red below." and the page scrolls to the first one.
- When everything passes: locked fields lock again, toast "Registration form saved. Next: Assignment Rules", and Step 2 opens.
- **Save as draft** keeps the form without running the checks (toast "Draft saved").

## 7. Step 2: Assignment Rules

Card: "Assignment Rules · Step 2 of 2 · \[Sponsor\] · \[Contest\]", intro "Anyone with the contest's link can register. Here you manage the link, choose which quizzes registrants get (now or later), limit email domains if needed, and decide how Registration IDs are given." Six numbered sections. Footer: **Back** (to Step 1), **Save as draft**, **Save registration form** (**Save changes** when editing).

### 7.1 Contest registration link

- One link per form, from the contest name: e.g. `https://bp.link/inter-college-maths-cup`.
- Status pill: "Live after you save", or "Turned off". Hint: "You can share it before any quiz is given to this form."
- **Copy link** (toast "Link copied"), **QR code** (dialog with the QR, the link and **Download PNG**, file `BrainPulses-<slug>-QR.png`), **Open as participant** (registration page in a new tab).
- **Link is active** switch (default on). Off: new people can't register; visitors see "This link is no longer active."; people already registered can still log in and take their quizzes. An amber note shows while it's off.
- **Regenerate link** (with confirmation): a new link is made and the old one stops working at once ("This link is no longer active."). Registered people are not affected. Toast "New link created. The old link no longer works."

### 7.2 Quizzes this form gives access to

- **Optional.** Tick boxes for the contest's quizzes, each showing name, dates and status (Active, Scheduled, Draft, Ended).
- **Ended** quizzes are greyed out: "Ended: can't be given".
- **None ticked:** note "No quiz yet. You can still share the link. People who register get their Registration ID and see 'No quizzes yet. You'll get an email when one is ready.' Come back to this page to give a quiz later."
- A quiz given to the form reaches **everyone already registered through it and everyone who registers later**.
- **Quiz ends before registration closes:** amber warning "\[Quiz\] ends \[date, time\], before registration closes (\[date, time\]). People who register after it ends won't be able to take it." Saving is still allowed.
- **Email participants when a quiz is given** switch (default on): people already registered get an email that the quiz is ready, with its dates.
- **Removing a quiz** \[Proposed\]: people who haven't started it stop seeing it; anyone with an attempt keeps their result in Reports.

### 7.3 Who can register

- Fixed: **Anyone with the link**. Dates and seats come from Step 1.
- **Only allow emails from certain domains** switch (default off). When on:
  - **Allowed domains** (required): tags. Enter, comma, space or paste adds; input is cleaned (lower case; leading @, http(s):// and paths removed); shown as @infosys.com. Invalid: ""\[text\]" isn't a valid domain. Use a form like infosys.com." Duplicates ignored with a toast.
  - **Message when the domain isn't allowed** (required, editable, max 160 characters). Default "Please use your {domains} email address to register." `{domains}` becomes the allowed domains joined by "or". A preview shows it under a sample Email field.
  - Checked on the registration form and on admin adds.

### 7.4 Registration ID and returning participants

- Format **BP + 8 digits**, unique across BrainPulses, the only login, shown after registering and emailed.
- **Give returning participants their existing Registration ID** switch (default **on**). On: they keep their ID and one login shows all their quizzes and assessments. Off: everyone registering on this form gets a new ID.
- **Matching rule** (two radio cards, greyed out while the switch is off):

| Rule | Matches on | Hint |
| --- | --- | --- |
| **Name + contact** (default) | First name AND (Email OR Mobile) | "Safer when people share an email or phone, like siblings." |
| **Contact only** | Email OR Mobile | "Catches people who type their name differently. Names aren't checked." |

- Comparison: first name ignores capital letters and extra spaces; email ignores capital letters; mobile compares the 10 digits.
- **Only one of email or mobile matches:** the person keeps their existing ID. Their saved profile keeps the old details; the new value is stored with this registration only.
- **Contact only** shows an amber note: "Because names aren't checked, two people who register with the same email or mobile (for example siblings using a parent's number) get the same Registration ID and share one login."
- Example table on the page (follows the chosen rule):

| Already saved | Registers with | Name + contact | Contact only |
| --- | --- | --- | --- |
| Riya Sharma · riya@gmail.com · 98110 22334 | Riya · riya@gmail.com · 98110 22334 | Existing ID | Existing ID |
| Riya Sharma · riya@gmail.com · 98110 22334 | Riya · riya@gmail.com · 99887 76655 | Existing ID | Existing ID |
| Riya Sharma · riya@gmail.com · 98110 22334 | Riya · riya.s@yahoo.com · 98110 22334 | Existing ID | Existing ID |
| Riya Sharma · riya@gmail.com · 98110 22334 | Priya · riya@gmail.com · 98110 22334 | New ID (first name differs) | Existing ID |
| Riya Sharma · riya@gmail.com · 98110 22334 | Riya · riya.new@gmail.com · 90000 22222 | New ID | New ID |
| (not registered before) | Aman · aman@gmail.com · 90000 11111 | New ID | New ID |

### 7.5 Logins

- A login stays active until an admin deactivates it on the Participants page; it doesn't expire when quizzes end.
- Someone with no quiz yet still logs in and sees "No quizzes yet. You'll get an email when one is ready."

### 7.6 Adding participants yourself

- After saving, from the **Participants page**: one by one or in bulk (Excel). Each is emailed their ID, gets the form's quizzes, and the domain and returning-participant rules apply.

### 7.7 Checks and saving

- Errors show only after **Save registration form** (plus live domain-format errors).
- Domain switch on with no domains: "Add at least one allowed domain, or turn this setting off." Empty message: "Add the message participants see when their email domain isn't allowed."
- With errors: red banner "Fix \[n\] fields before continuing." and scroll to the first.
- No quiz ticked is **not** an error.
- On save the link goes live and the admin returns to Students (or to the form's view page when editing).

## 8. Form view page (read-only)

Opened from a form's row or **Open** on the Students page.

- **Back link** "‹ Students", breadcrumb "BrainPulses / Students / \[Contest\]", title = contest name, line "\[Sponsor\] · registration form · \[n\] registered".
- Buttons: **+ Give a quiz** and **Edit form** (lock icon, primary).
- **Link bar:** "Link active" or "Link turned off" pill, the link, **Copy link**, and "View only. Editing needs your admin password."
- Cards (read-only):

| Card | Shows |
| --- | --- |
| Quizzes this form gives access to | Each quiz with dates and status, "\[n\] given"; or "No quiz yet. People can still register with the link. They see 'No quizzes yet' until you give one." |
| Registration window & seats | Opens, Closes, Seats (or Unlimited) |
| Who can register | Anyone with the link; email domains (or Any); the domain message when set |
| Registration ID | Format; returning participants (keep existing ID / always new ID); matched on (First name and (email or mobile number) / Email or mobile number); email when a quiz is given (On/Off) |
| Form header | Welcome message; what's shown |
| Form fields | Every field: label (with a Locked tag), type (with options), Required/Optional |

## 9. Give a quiz (later)

From **+ Give a quiz** on the Students list (forms with no quiz) or on the view page. **No password needed**: it only adds access and doesn't change the form.

- Dialog "Give a quiz": "Everyone registered through the \[contest\] form (\[n\] now) and everyone who registers later gets the quizzes you tick."
- The contest's quizzes with dates and status:
  - already given: ticked and greyed ("Already given");
  - ended: greyed ("Ended: can't be given");
  - ends before registration closes: amber line "Ends before registration closes (\[date, time\]). Late registrants can't take it."
- Tick box **Email the people already registered that the quiz is ready** (default = the form's email setting).
- **Give quiz** is disabled until one is ticked; it reads "Give \[n\] quizzes" for more than one.
- Result: toast "\[Quiz\] given to \[contest\]. \[n\] registered people were emailed." The list and view page update straight away.

## 10. Edit a saved form

1. **Edit form** on the view page → admin password dialog (section 11).
2. Correct password → Step 1 opens **filled with the saved form**, titled "Edit registration form". Sponsor and contest are locked.
3. Save & continue → Step 2, filled with the saved settings (quizzes, link state, domains, message, returning participants, matching rule, email setting). The button reads **Save changes**.
4. Save changes → back to the **view page** with toast "Changes saved." (plus "\[n\] registered people were emailed about the new quiz." when a quiz was added with email on).

- The four locked fields stay locked inside edit; unlocking them asks for the password again (same rule as creating).
- If people have already registered, a notice above the fields says "\[n\] people have already registered. Changes apply to new registrations only." New fields are blank for existing registrants; deleted fields keep their old answers on the Participants page and in downloads. (Not shown in the reference build.)

## 11. Admin password checks

The password is the **logged-in admin's own admin-portal login password**, checked by the server. (The reference build uses admin123 for demo only.)

| Where | Dialog title | Button | After success |
| --- | --- | --- | --- |
| Edit form (view page) | Enter your admin password | Continue to edit | Opens edit (section 10) |
| Unlock locked fields (Step 1) | Unlock locked fields | Unlock | Fields unlocked; toast "Fields unlocked" |

- Both: password box with **Show/Hide**, Enter submits, Cancel and Esc close.
- Empty: "Enter your password." Wrong: "Incorrect password. \[n\] tries left." (box cleared).
- 5 wrong tries: "Too many incorrect tries. Editing is blocked for 15 minutes." ("Unlocking is blocked…" for locked fields). \[Proposed\]
- Each successful unlock or edit is recorded (admin, date and time). \[Proposed\]

## 12. Participant-side messages

| Situation | Message |
| --- | --- |
| Email domain not allowed | The form's custom message, e.g. "Please use your @infosys.com email address to register." |
| Link off or regenerated (old link) | "This link is no longer active." |
| Registration not open yet / closed / full | "Registration opens on \[date, time\]." / "Registration has closed." / "All seats are taken." |
| Registered, new ID | ID on screen; "Use it to log in. Your quizzes appear after you log in." (also emailed) |
| Returning participant (switch on) | "You're already registered with BrainPulses. Use your existing Registration ID BPxxxxxxxx to log in." (also emailed) |
| Already registered on this form | "You're already registered. Log in with your Registration ID." |
| Logged in, no quiz yet | "No quizzes yet. You'll get an email when one is ready." |
| Quiz given later (email on) | Email "\[Quiz\] is ready for you" with dates and a Log in link |

## 13. Data saved for each form

| Group | Fields |
| --- | --- |
| Identity | Form id, sponsor, contest (unique: one form per contest), created by/at, updated by/at |
| Step 1 | Registration opens, closes, seats (empty = unlimited); welcome message; header chips (image, sponsor, registration closes, seats left); fields in order (label, type, required, placeholder, help, max characters, min/max value, min/max selections, options, consent text, terms link, locked flag); deleted locked fields |
| Step 2 | Link slug, link active, quizzes given, email when a quiz is given, domain restriction on/off, allowed domains, domain message, returning participants on/off, matching rule (name + contact / contact only) |
| Counts | Registrations so far (for seats left and the Students page) |

## 14. Defaults

| Item | Default |
| --- | --- |
| Forms per contest | One |
| Registration opens / closes | When saved / admin picks |
| Seats | Empty (unlimited) |
| Header chips | All ticked |
| Fields | First name, Last name, Email, Mobile number (locked) + Gender (optional) + Terms & Conditions (required) |
| Extra field limit | 20 |
| Text / Textarea max characters | 100 / 500 |
| Link | Active |
| Quizzes | None (optional) |
| Email when a quiz is given | On |
| Domain restriction | Off |
| Returning participants keep ID | On |
| Matching rule | First name AND (Email OR Mobile) |
| Wrong password limit | 5 tries, then 15 minutes \[Proposed\] |

## 
