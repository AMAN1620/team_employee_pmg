# PMG: Stitch Screen Prompts

Prompts for generating the PMG prototype screens in Google Stitch and exporting them to Figma. The screens follow the features and IDs in [PMG_Features.md](PMG_Features.md).

## How to use these in Stitch

1. Create one Stitch project and choose **Web** (desktop) as the device type. Keep every PMG screen in this project.
2. Paste **Prompt 0 (UI kit)** first. Before going further, check Stitch's theme settings: primary color teal `#0F766E`, font Inter, rounded corners. Fix the theme there, not screen by screen.
3. Add each screen to the same project and paste its prompt. Every prompt starts with the same style line, so screens stay consistent even when Stitch treats each prompt on its own.
4. Generate the **P0** screens first. The index below shows which demo step each screen supports.
5. Refine with short follow-ups that change one to three things at a time, for example "Move the check-in banner below the goals card and make it more compact." Use annotate-to-edit for small fixes.
6. If Stitch leaves out parts of a long prompt, generate the layout first, then add the missing sections as follow-ups.
7. If screens drift apart visually, select them together and apply one theme prompt to all of them.
8. When a screen is final, export it to Figma. When Stitch launched, Figma export only worked in Standard mode; if you don't see the option, switch modes.

Before generating, replace **PMG** with the final product name if you've chosen one, and **Slack** with **Teams** if you go with Teams.

## Demo data used across screens

Keep these the same in any extra prompts you write, so all the screens tell one story.

- **Company:** Acme Labs, 312 employees, Bengaluru. Quarter: Q3 FY27 (1 Oct–31 Dec 2026). Demo date: Thursday 19 Nov 2026.
- **People:** Ananya Rao (Product Analyst, the employee persona), Vikram Mehta (Product Lead, Ananya's manager), Sneha Iyer (HR Business Partner). Vikram's team: Ananya, Meera Joshi (Product Designer), Rohan Das (Associate PM), Farah Khan (Product Analyst), Dev Patel (UX Researcher). Others: Karan Shah (Software Engineer), Arjun Nair (Data Platform Engineer), Sanjay Gupta (Finance Manager), Kavya Menon (Customer Success Lead).
- **Goals:** company goal "Grow ARR to ₹40 Cr by March 2027" → Product team goal "Cut new-customer time-to-value from 14 to 5 days" → Ananya's goals: "Launch the self-serve onboarding checklist" (On track, 3 of 5 milestones, due 15 Dec), "Reduce onboarding drop-off from 38% to 25%" (At risk, 30% of the way, due 31 Dec) and "Run 12 customer discovery interviews" (On track, 8 of 12, due 31 Dec).
- **Blockers:** "Need read access to the product events dashboard" (waiting on Arjun Nair, open 6 days since 13 Nov, Accepted); "Pricing approval for the onboarding discount" (waiting on Sanjay Gupta, need-by 17 Nov, Overdue).
- **Review cycle:** "Mid-year review FY 2026–27". Self-reviews due 27 Nov, manager reviews due 11 Dec. Rating scale: 1 Needs improvement, 2 Partially meets, 3 Meets, 4 Exceeds, 5 Outstanding.

## Screen index

| # | Screen | Role | Features | Priority | Demo step |
|---|---|---|---|---|---|
| 0 | UI kit | All | Design system | First | — |
| 1 | Demo sign-in and role picker | All | S.2 | P0 | Start |
| 2 | Home | Employee | 10.1 | P0 | 5 |
| 3 | Weekly check-in review | Employee | 3.1, 3.2 | P0 | 3 |
| 4 | Goal detail | Employee | 4.1, 4.3, 8.1–8.4, 1.3 | P0 | 3, 4 |
| 5 | New goal | Employee | 4.1, 4.2 | P0 | 2 |
| 6 | Blockers | Employee | 1.1–1.4, 9.2 | P0 | 4 |
| 7 | Wins journal | Employee | 2.1–2.3, 9.1–9.3 | P0 | 5 |
| 8 | 1:1 | Employee, Manager | 7.1–7.4 | P0 | 6 |
| 9 | Self-appraisal draft | Employee | 5.1 | P0 | 7 |
| 10 | Goals and alignment | Employee | 8.4 | P1 | — |
| 11 | Feedback | Employee | 6.1, 6.2 | P1 | — |
| 12 | Privacy and sharing | Employee | S.2, 9.1 | P1 | — |
| 13 | Team view | Manager | S.5, 6.3 | P0 | 6 |
| 14 | Goal approval | Manager | 4.1, 4.2 | P0 | 2 |
| 15 | Manager review | Manager | S.8, 4.4 | P0 | 7 |
| 16 | HR overview | HR | S.9, S.11 | P0 | 7 |
| 17 | Company goals | HR | S.4 | P0 | 1 |
| 18 | Review cycle setup | HR | S.6, S.7 | P0 | 1 |
| 19 | Calibration | HR | S.10 | P1 | — |
| 20 | People and org setup | HR | S.1 | P1 | — |
| 21 | Integrations and chat connection | HR | S.3 | P0 | Setup |
| 22 | Chat bot mockup | All | 3.1, 3.2, 1.2, 9.1, 4.1 | Pitch | 2–5 |

---

## 0. UI kit (paste first)

```text
Create a UI kit screen for "PMG", a desktop web app for performance management used by employees, managers and HR at Indian companies with 100–500 people. PMG should feel like a supportive coach, not an HR admin or surveillance tool: calm, warm, trustworthy, modern and uncluttered. Lay the kit out on a 1440px-wide canvas in clearly labelled sections.

Colors: primary deep teal #0F766E (hover #115E59, light tint #CCFBF1); violet #7C3AED used only for wins, kudos and recognition (tint #EDE9FE); page background #F8FAFC; cards white; borders #E2E8F0; text #0F172A; secondary text #64748B.
Goal status pills, always an icon plus a text label, never color alone: On track (green #15803D on #DCFCE7), At risk (amber #B45309 on #FEF3C7), Off track (red #B91C1C on #FEE2E2). Blocker pills: Waiting (slate), Accepted (teal), Needs info (amber), Overdue (rose #BE123C on #FFE4E6), Resolved (green).

Typography: Inter. Page title 28px semibold, section title 18px semibold, body 14px regular, labels 12px medium, generous line height.
Shape and spacing: 8px grid; cards with 12px corners, a 1px border and a very soft shadow; buttons and inputs with 8px corners, 40px tall; simple outline icons.

Show these components:
1. Buttons: primary (solid teal, white text), secondary (white with border), tertiary (teal text), destructive, disabled.
2. Inputs: text field, select, date picker, search, textarea, and a people picker with avatar chips.
3. The status pills and blocker pills above, plus role badges: Employee, Manager, HR.
4. A goal row: title, linked team goal in muted text, progress bar with percentage, status pill and due date.
5. An "AI suggestion" box: light teal tint, sparkle icon, the label "Drafted by AI · Review before saving", suggested text, and actions Use / Edit / Dismiss.
6. Evidence chips: small rounded chips with icons for Win, Check-in, Blocker, Feedback, Kudos and a Jira link, plus a numbered citation chip like [1].
7. A kudos card with a violet tint, the giver's avatar and a short message.
8. Tabs, a segmented control, toggle, checkbox, radio, toast, empty state and a right-side drawer.
9. The app shell: a 248px white left sidebar with the PMG logo (a teal rounded square with an upward arrow, plus the wordmark "PMG"), navigation items with icons, and a persona card at the bottom (avatar, name, role badge and a "Switch role" link); and a 64px top bar with the page title, a search field, a primary "Check in" button, a notifications bell and the user's avatar.
```

---

## Shared

### 1. Demo sign-in and role picker · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background. No sidebar or top bar on this screen.

Design the sign-in screen for the PMG demo, where the presenter picks which person to sign in as.

Layout: content centered on the light background. At the top: the PMG logo and wordmark, the headline "Welcome to PMG" and the line "Goals, blockers, wins and reviews in one place. Pick a demo profile to continue."

Below, three large persona cards in a row, about 320px wide each. Each card has an avatar, name, job title, team, a role badge, three short lines describing what that role sees, and a button:
1. Ananya Rao · Product Analyst · Product team · Employee badge · "Weekly check-in in chat", "Goals, blockers and wins", "AI-drafted self-appraisal" · button "Continue as Ananya". Show this card selected, with a teal border and a check icon.
2. Vikram Mehta · Product Lead · Product team · Manager badge · "Team health at a glance", "Goal approvals and 1:1s", "Reviews with evidence beside the rating" · button "Continue as Vikram".
3. Sneha Iyer · HR Business Partner · People team · HR badge · "Company goals and review cycles", "Review progress by team", "Calibration and insights" · button "Continue as Sneha".

Under the cards: a muted line "Demo company: Acme Labs · 312 employees · Bengaluru" and a disabled-looking link "Use company sign-in". At the bottom, a small reassurance line with a shield icon: "PMG never tracks keystrokes, screens or online status."
```

---

## Employee screens

### 2. Home · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the employee Home screen ("My Performance") for Ananya Rao, Product Analyst. Sidebar: employee navigation (Home active, then Goals, Check-ins, Blockers, Wins, 1:1s, Feedback, Reviews), with Ananya's persona card and an Employee badge at the bottom. Top bar title: "Good afternoon, Ananya". The date is Thursday 19 Nov 2026.

Row 1, full width: a slim banner card with a chat-bubble icon: "Your check-in is in. AI sorted your reply into 5 items. Confirm them in about a minute." Buttons "Review check-in" (primary) and "Later" (tertiary). On the right: "Last confirmed: Thu 12 Nov".

Row 2, left 8 columns: a "My goals" card with three goal rows. Each row shows the title, the linked team goal in small muted text, a progress bar with percentage, a status pill, the due date and a chevron:
- "Launch the self-serve onboarding checklist" · 3 of 5 milestones · 60% · On track · Due 15 Dec
- "Reduce onboarding drop-off from 38% to 25%" · 30% · At risk · Due 31 Dec · small rose note "1 blocker open for 6 days"
- "Run 12 customer discovery interviews" · 8 of 12 · 67% · On track · Due 31 Dec
Card footer: "Q3 FY27 · 54% of the quarter gone" and a "View all goals" link.
Row 2, right 4 columns: a "Next 1:1" card: "With Vikram Mehta · Today, 4:00 PM", an agenda preview with three items (1 blocker, 1 at-risk goal, 1 win), an amber chip "1 action overdue", and a button "Open agenda".

Row 3, three equal cards:
- "Blockers": "Need read access to the product events dashboard" · waiting on Arjun Nair, Data Platform · Accepted pill · open 6 days · a link "+1 more". Below, a "Waiting on you" item: "Rohan Das needs final copy for onboarding emails · need by 20 Nov" with a "Respond" button.
- "Recent wins and kudos" (violet accents): kudos from Karan Shah "For the clearest spec we've had this quarter"; the win "Shipped onboarding checklist v1 to 20% of new accounts" with a Jira evidence chip; an automatic item "Unblocked Rohan's analytics question in 1 day". Link "Open wins journal".
- "Coming up": "Mid-year review · self-appraisal due 27 Nov" with the status "Not started" and a primary button "Draft my self-appraisal"; below, "Feedback this month: 3" with a one-line snippet of the latest feedback from Vikram.

Keep it calm and easy to scan, with plenty of white space.
```

### 3. Weekly check-in review · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the weekly check-in review screen, where the employee confirms what AI pulled out of their check-in before anything is saved or shared. Sidebar: employee navigation with Check-ins active, signed in as Ananya Rao. Page title "Check-in · Week of 16 Nov", with a status chip "Waiting for your confirmation".

Top card, "Your reply", with a chat icon and "Sent from chat · Thu 19 Nov, 10:12 AM". It shows the questions and answers in a quote style:
- What moved? "Checklist v1 is live for 20% of new accounts and step-2 completion went up 9%. Also covered Tier-2 support escalations during yesterday's outage."
- What's stuck? "Still waiting on Data Platform for dashboard access. I also need the support-ticket export from Customer Success to see why people drop off."
- What's next? "Run the A/B test on step 3 once I have the data."
- How was your week? A 1–5 scale with 4 ("Good") selected.

Main section titled "Here's what we found", with a sparkle icon and the label "Drafted by AI": five editable item cards. Each shows a type icon and label, the content, the linked goal, and the actions "Looks right" (check), "Edit" and "Remove":
1. Progress (teal) · goal "Launch the self-serve onboarding checklist" · "Checklist v1 live for 20% of new accounts" · suggested update: 3 of 5 milestones.
2. Win (violet) · "Step-2 completion up 9% after checklist v1" · goal "Reduce onboarding drop-off" · visibility selector set to "Manager" · an "Add evidence link" button.
3. New blocker (rose) · "Need the support-ticket export to size drop-off reasons" · Waiting on: Kavya Menon, Customer Success (person picker) · Need by: 24 Nov · goal "Reduce onboarding drop-off".
4. Existing blocker · "Matches your open blocker: dashboard access · waiting on Arjun Nair · 6 days" · buttons "Nudge Arjun" and "Mark resolved".
5. Unplanned work (slate) · "Covered Tier-2 support escalations during the 18 Nov outage" · tag "Support".
The first two cards already show a green "Confirmed" state.

Right column (4 columns): a "Where this goes" card with small icons: goal progress updates; Kavya gets the blocker request in chat; the win goes into your journal; items appear in your 1:1 agenda with Vikram; everything is saved for your self-appraisal. Under it, a privacy note with a lock icon: "Your manager sees confirmed items only. HR never sees your replies."

A sticky footer bar: "5 items · 2 confirmed", with buttons "Confirm all" (primary) and "Save for later".
```

### 4. Goal detail · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the goal detail page for Ananya Rao's goal "Reduce onboarding drop-off from 38% to 25%". Sidebar: employee navigation with Goals active. Breadcrumb: "Goals / Reduce onboarding drop-off".

Header card: the goal title (24px semibold), an "At risk" status pill, owner avatar "Ananya Rao", "Approved by Vikram Mehta on 2 Oct", due date "31 Dec 2026", and an alignment chain of three linked chips: "Company: Grow ARR to ₹40 Cr by March 2027" → "Product team: Cut time-to-value from 14 to 5 days" → "This goal". Buttons: "Update progress" (primary), "Raise blocker" (secondary) and an overflow menu.

Under the header, side by side:
- A health box with an amber tint and an alert icon: "At risk: drop-off is at 34.1%, 30% of the way to target, with 54% of the quarter gone. 1 blocker has been open for 6 days."
- An AI suggestion box titled "Suggested next steps · Drafted by AI" with two suggestions, each with "Add as action" and "Dismiss": "Ask Vikram to escalate the dashboard access request" and "Run the drop-off analysis on last month's data export while you wait". A tertiary link: "Write a recovery plan".

Left column (8 columns):
1. A "Goal card" panel with labelled fields: Outcome; Measure ("% of new accounts that abandon onboarding before step 3"); Baseline 38%; Target 25%; Deadline 31 Dec; Dependencies ("Event tracking from Data Platform"). Then a rubric table: Partially meets "Between 25% and 30%"; Meets "At or below 25% by 31 Dec"; Exceeds "Below 22%, or 25% reached by 30 Nov".
2. A "Milestones" checklist with dates: "Baseline analysis" done 9 Oct; "Identify top 3 drop-off steps" done 30 Oct; "Get event dashboard access" with a rose "Blocked 6 days" chip; "Run A/B test on step 3" due 4 Dec; "Roll out the winning version" due 18 Dec. A progress bar: "2 of 5 milestones".
3. An "Activity" timeline: check-in updates, a kudos, a blocker raised and the goal approval, each with an icon, one line of text and a date.

Right column (4 columns):
- "Blockers on this goal": the open dashboard-access blocker (Accepted, waiting on Arjun Nair, 6 days) and a resolved one, "Event schema review · resolved by Arjun Nair in 2 days". Footer with a large number, "8 days blocked this quarter", labelled "Shown to your manager at review time".
- "Linked wins": two win items with evidence chips.
- "Change log": "Target changed from 20% to 25% on 15 Oct · Reason: baseline corrected after analysis · Approved by Vikram".
```

### 5. New goal · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the "New goal" screen, where an employee drafts a goal and sends it to their manager for approval. Sidebar: employee navigation with Goals active, signed in as Ananya Rao. Page title "New goal", subtitle "Vikram will review this before it's final."

Left (8 columns): one card with a form in numbered sections:
1. "Link to a team goal": a select showing "Product team · Cut time-to-value from 14 to 5 days", with a muted line under it: "Supports the company goal: Grow ARR to ₹40 Cr by March 2027". Next to it, "Start from a template" chips: "Launch a feature", "Improve a metric", "Customer outcome", "Learning goal".
2. "What do you want to achieve?": a text field filled with "Improve the onboarding experience". Directly below, an AI quality check box (amber tint, sparkle icon): "This goal is hard to measure. Try:" followed by the suggestion "Reduce onboarding drop-off from 38% to 25% by 31 Dec", with buttons "Use suggestion", "Edit" and "Dismiss".
3. "How will you measure it?": fields for Measure, Baseline, Target and Deadline (a date picker showing 31 Dec 2026).
4. "What does good look like?": three rubric rows prefilled from the company rating scale (Partially meets, Meets, Exceeds), each with an editable description.
5. "Dependencies (optional)": a tag input containing "Data Platform team".
6. "Milestones (optional)": two milestone rows with dates, an "Add milestone" link, and a tertiary button with a sparkle icon, "Suggest milestones".

Right (4 columns), sticky: a "Goal card preview" showing how the goal will look to the manager; a readiness checklist ("Measurable ✓", "Has a deadline ✓", "Linked to a team goal ✓", "Rubric reviewed ○"); a primary button "Send to Vikram for approval"; and a secondary button "Save draft".
```

### 6. Blockers · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Blockers page with the "Raise a blocker" drawer open on the right. Sidebar: employee navigation with Blockers active, signed in as Ananya Rao. Page title "Blockers", subtitle "Get unstuck faster. Time spent blocked is recorded on your goal."

Top: three small stat cards: "Open blockers: 2"; "Average time to resolve: 3.2 days"; and a violet card "Blockers you cleared for others: 5" with the note "Counts as recognized work".

Tabs: "Raised by me (2)", "Waiting on me (1)", "Resolved (4)". The first tab is selected and shows a list with columns: Blocker, Waiting on (avatar, name, team), Goal, Need by, Open for, Status, Actions.
- "Need read access to the product events dashboard" · Arjun Nair, Data Platform · Reduce onboarding drop-off · 24 Nov · 6 days · Accepted pill · reply "Will grant access by Friday" · actions "Nudge" and "Escalate".
- "Pricing approval for the onboarding discount" · Sanjay Gupta, Finance · Launch onboarding checklist · 17 Nov · 9 days · Overdue pill. Under this row, an inline amber prompt: "This is 2 days past the need-by date. Escalate to Vikram Mehta, your manager?" with buttons "Escalate" and "Not yet", and the note "Nothing escalates without your OK."

Right drawer (440px wide, white, with a shadow), titled "Raise a blocker", with these fields: "What's stuck?"; "Who can unblock this?" (person search with Kavya Menon, Customer Success, selected); "Which goal does this affect?" (select); "When do you need it by?" (date picker); "Anything they should know?" (textarea); a checked checkbox "Send the request in chat"; and buttons "Send request" (primary) and "Cancel". A muted line at the bottom: "Kavya will get Accept, Need info and Not me buttons in chat."
```

### 7. Wins journal · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar. Use violet as this page's accent color.

Design the Wins journal page. Sidebar: employee navigation with Wins active, signed in as Ananya Rao. Page title "Wins journal", subtitle "Your record of what you've achieved. Private unless you share it." Buttons "Add a win" (primary) and "Give kudos" (secondary).

Under the title: filter chips "All", "Wins", "Kudos received", "Helped others", "Unplanned work"; a goal filter dropdown; a quarter selector "Q3 FY27"; and a search field. Below, a strip of four small stat cards: "Wins this quarter 14", "Kudos received 6", "Blockers cleared for others 5", "Unplanned work logged 3".

Main list (8 columns), grouped under "This week" and "Last week". Each card shows a type icon and label, a title, a short description, a linked-goal chip, evidence chips (Jira ticket, Google Doc, screenshot), a date, and a visibility pill (Only me / Manager / Team / Company) with a lock or people icon:
- Win · "Step-2 completion up 9% after checklist v1" · goal "Reduce onboarding drop-off" · visible to Manager. Under it, an AI suggestion box, "Stronger wording · Drafted by AI": "Lifted step-2 onboarding completion by 9% for new accounts by launching checklist v1", with "Use", "Edit" and "Dismiss".
- Unplanned work · "Covered Tier-2 support escalations during the 18 Nov outage" · tag "Support" · visible to Manager.
- Win · "Shipped onboarding checklist v1 to 20% of new accounts" · goal "Launch onboarding checklist" · evidence chip "JIRA-482" · visible to Team.
- Kudos · from Karan Shah (avatar): "For the clearest spec we've had this quarter" · received via chat · visible to Team.
- Helped others · "Unblocked Rohan Das's analytics question in 1 day" · muted label "Added automatically when you cleared a blocker".

Right column (4 columns): a "November highlights" card ("Your top 3 wins are ready to review") with three short bullets and a button "Review and send to Vikram". Below it, a "How do you like to be recognized?" card with radio options "Privately with my manager", "In front of my team" (selected) and "Company-wide".
```

### 8. 1:1 · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the 1:1 page for the weekly meeting between Ananya Rao (employee) and Vikram Mehta (manager). Sidebar: employee navigation with 1:1s active. Header: both avatars, the title "Ananya & Vikram · Weekly 1:1", "Today, 4:00–4:30 PM", a "Google Meet" link chip, and buttons "Start notes" (primary) and "Reschedule".

A narrow left column lists past 1:1s by date (12 Nov, 5 Nov, 29 Oct), with today's meeting highlighted at the top.

Main column: "Agenda", with a chip "Auto-filled from goals, blockers and wins" (sparkle icon). Agenda items are cards with drag handles and a small source label:
- Blocker · "Dashboard access from Data Platform: open 6 days"
- At-risk goal · "Reduce onboarding drop-off: 30% of the way to target"
- Win · "Checklist v1 shipped to 20% of new accounts"
- Ananya's topic · "Path to Senior Analyst"
- Vikram's topic · "Input for Q4 planning"
Then an "Add a topic" input.

Below, "Action items" as a table with a checkbox, action, owner avatar, due date, linked goal or blocker, and status:
- "Ask the Data Platform lead to prioritise dashboard access" · Vikram · 20 Nov · Blocker · Open
- "Share drop-off analysis draft" · Ananya · 24 Nov · Goal · Open
- "Share promotion criteria for Senior Analyst" · Vikram · due 16 Nov · rose "Overdue 3 days" pill · muted note "Carried over from 5 Nov"
- "Send checklist v1 results to Sales" · Ananya · done (checked and muted)
Then an "Add action" row with owner and due-date pickers.

Right column (4 columns): a "Shared notes" card with a rich-text area and a tertiary button with a sparkle icon, "Find action items in notes"; and a "Reminders" card: "You both get a chat reminder a day before an action is due."
```

For the manager's version, generate the same screen again with the manager sidebar and Vikram as the signed-in persona.

### 9. Self-appraisal draft · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the AI self-appraisal draft screen for the "Mid-year review FY 2026–27". Sidebar: employee navigation with Reviews active, signed in as Ananya Rao. Header: "Self-appraisal · Mid-year review FY 2026–27", "Due 27 Nov · 8 days left", a "Draft" status chip, and buttons "Submit to Vikram" (primary, disabled until every section is reviewed) and "Save draft". Under the header, an info bar with a sparkle icon: "Drafted by AI from 14 wins, 11 check-ins, 4 resolved blockers and 3 pieces of feedback. Every sentence links to its source. Review each section before you submit."

Split layout.
Left (7 columns): the review form, with one card per goal, matching the company form. Each card has the goal title, a horizontal 1–5 self-rating scale using the rubric labels (Needs improvement, Partially meets, Meets, Exceeds, Outstanding), and an editable rich-text answer with small numbered citation chips after sentences. Example for "Reduce onboarding drop-off": "I launched onboarding checklist v1 to 20% of new accounts and lifted step-2 completion by 9% [1] [2]. Progress slowed while I waited 6 days for event dashboard access from Data Platform [3]." The self-rating "3 Meets" is selected. Each card has a "Reviewed" toggle; the first one is on. A last card, "Beyond my goals", lists unplanned work and help given to others, also with citations. The citation chip [3] is shown selected.

Right (5 columns), sticky "Evidence" panel with tabs "All", "Wins", "Check-ins", "Blockers", "Feedback". At the top, the selected source [3] is highlighted: a blocker card "Need read access to the product events dashboard · open since 13 Nov · 6 days · waiting on Arjun Nair (Accepted)" with an "Open source" link. Below, a scrollable list of evidence cards, each with an icon, a date and an "Insert" button; unused items carry a muted "Not cited yet" tag.

At the bottom of the left column, a muted note: "PMG never submits for you. Vikram will see your answers and the linked evidence."
```

### 10. Goals and alignment · P1

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Goals page for an employee, with a segmented control to switch between "List" and "Alignment" views; Alignment is selected. Sidebar: employee navigation with Goals active, signed in as Ananya Rao. Page title "My goals · Q3 FY27", primary button "New goal". Under the title: summary chips "3 goals · 2 on track · 1 at risk", a quarter selector and a toggle "Show teammates' goals" (on).

Alignment view: a left-to-right tree of rounded node cards joined by thin connector lines.
- Left node, dark teal: the company goal "Grow ARR to ₹40 Cr by March 2027" with a 58% progress bar.
- Middle node: the team goal "Product: Cut new-customer time-to-value from 14 to 5 days" · owner Vikram Mehta · On track.
- Right nodes: Ananya's three goals with status pills and progress bars. Each has an editable "My contribution" line, for example "The checklist removes 4 setup steps for new accounts."
- Teammates' goals under the same team goal appear faded, with avatar chips for Meera Joshi and Rohan Das, to show shared context.

Under the diagram, a muted helper line: "See how your work connects to what the company is trying to achieve."
```

### 11. Feedback · P1

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Feedback page for an employee. Sidebar: employee navigation with Feedback active, signed in as Ananya Rao. Page title "Feedback", buttons "Ask for feedback" (primary) and "Give feedback" (secondary). Tabs: "Received (3)", "Requested (2)", "Given (4)", with Received selected.

Main (8 columns): feedback cards. Each shows the giver's avatar and name, what the feedback is about (a goal or piece of work), a date, and three labelled parts: Keep doing, Improve, Next action.
- Vikram Mehta · on "Checklist v1 launch" · 13 Nov · Keep doing: "Clear rollout plan and crisp updates to Sales." · Improve: "Bring Support in earlier on launches." · Next action: "Add Support to the launch checklist · Ananya · 30 Nov", with a button "Add to my actions".
- Meera Joshi (peer) · on "Onboarding checklist spec" · 6 Nov · a shorter card with the same structure.

Right (4 columns): an "Ask for feedback" composer card with: "What should they look at?" (goal "Reduce onboarding drop-off" selected and an attachment chip "Drop-off analysis v2.pdf"); "Who?" (people picker with Vikram Mehta and Farah Khan); "By when?" (20 Nov); "What kind?" chips "Quick reaction" (selected) and "Detailed review"; and a primary button "Send in chat". Below, a small "Waiting for replies" list: "Review my drop-off analysis deck · Vikram · due 20 Nov".
```

### 12. Privacy and sharing · P1

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the employee "Privacy and sharing" settings page, opened from the persona card in the sidebar. Signed in as Ananya Rao. Page title "Privacy and sharing", subtitle "You decide what others see."

Cards stacked in one column, 8 columns wide:
1. "Who sees what": a table with rows Goals and progress, Confirmed check-in items, Raw check-in replies, Wins journal, Kudos received, Days blocked, Self-appraisal; and columns You, Your manager, HR. Use check icons, dashes and the label "If you share". For example: raw check-in replies (You ✓, Manager —, HR —); wins journal (You ✓, Manager "If you share", HR —); goals and progress (all ✓); self-appraisal (You ✓, Manager ✓, HR "After submission").
2. "Default visibility for new wins": a segmented control Only me / Manager (selected) / Team / Company.
3. "How do you like to be recognized?": radio options Privately with my manager / In front of my team (selected) / Company-wide.
4. "Connected work tools": Jira (connected, "Disconnect") and Google Calendar (not connected, "Connect"), with the note "PMG reads only the work items you connect."
5. "What PMG never does": a reassurance card with a shield icon listing "No keystroke or screen tracking", "No online-status or hours tracking", "No location tracking" and "AI never shares anything you haven't confirmed".
6. "Your data": a secondary button "Export my achievement record (PDF)".
```

---

## Manager screens

### 13. Team view · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the manager's Team view for Vikram Mehta, Product Lead, who manages 5 people. Sidebar: manager navigation (Team active, Approvals with a "1" badge, Blockers, 1:1s, Reviews, then a divider and My goals, My wins). The persona card at the bottom shows Vikram with a Manager badge. Top bar title "Product team".

Row 1: four stat cards: "Goal health: 9 on track · 3 at risk · 1 off track" with a small stacked bar; "Open blockers: 4 · 1 waiting on you"; "Check-ins this week: 4 of 5"; "Mid-year review: 3 of 5 self-reviews in".

Row 2, left 8 columns: a "Needs your attention" card, a prioritized list where each item has an action button:
- Goal approval · Rohan Das · "Increase activation email click rate to 12%" · "Review"
- Blocker waiting on you · Farah Khan · "Approve budget for the survey tool" · open 4 days · "Respond"
- At-risk goal · Ananya Rao · "Reduce onboarding drop-off" · "Blocked 6 days on data access" · "Add to 1:1"
- Feedback moment · Meera Joshi finished the milestone "Onboarding UI final designs" · "Give quick feedback"
Row 2, right 4 columns: "This week's highlights" with three team wins in violet, and "Upcoming 1:1s" with times.

Row 3, full width: a "Team" table with one row per person: avatar, name and role; goals (three small status dots with counts); open blockers; last check-in (a date, or an amber "Missed" chip for one person); a sparkline of the weekly 1–5 score; most recent win (one line); next 1:1; and a row action "Open". People: Ananya Rao (Product Analyst), Meera Joshi (Product Designer), Rohan Das (Associate PM), Farah Khan (Product Analyst), Dev Patel (UX Researcher).

A small muted note under the table: "You see what your team confirms and chooses to share."
```

### 14. Goal approval · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the goal approval screen, where a manager reviews a goal an employee drafted. Sidebar: manager navigation with Approvals active, signed in as Vikram Mehta. Breadcrumb "Approvals / Rohan Das". Header: Rohan's avatar, "Rohan Das proposed a goal", "Submitted 18 Nov", and a status chip "Waiting for you".

Main (8 columns): the proposed goal card in read mode. Title "Increase activation email click rate to 12%"; linked team goal "Cut time-to-value from 14 to 5 days"; Measure "Click-through rate on the 3 activation emails"; Baseline 7%; Target 12%; Deadline 31 Dec; Dependencies "Marketing ops for email tool access"; rubric rows Partially meets "8–9%", Meets "12%", Exceeds "12%"; and a milestones list. Each field shows a small comment icon; the Target field has an open comment thread from Vikram: "Is 12% realistic in 6 weeks? Our best email gets about 9%."

Below the card, an AI quality check box (teal tint, sparkle icon): "Measurable and time-bound. One issue: 'Exceeds' is the same as 'Meets'." with a link "Suggest wording".

Right (4 columns), a sticky decision card: radio options "Approve", "Approve with edits" and "Request changes" (selected); a textarea "Message to Rohan" prefilled with "Let's make 10% Meets and 12% Exceeds. Can you update the rubric?"; a primary button "Send"; and the muted note "Rohan gets this in chat. Every change is kept in the goal's change log." Below, a mini list "Rohan's other goals" with status pills.
```

### 15. Manager review · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the manager review screen where Vikram Mehta rates Ananya Rao in the "Mid-year review FY 2026–27". Sidebar: manager navigation with Reviews active. Header: Ananya's avatar and name, "Manager review · Due 11 Dec", progress "2 of 3 goals rated", and buttons "Submit review" (primary) and "Save draft". A muted banner under the header: "AI can summarize the evidence. Ratings are always yours."

Split layout.
Left (7 columns): one card per goal. The open card is "Reduce onboarding drop-off from 38% to 25%". It has five selectable rating tiles in a row (1 Needs improvement, 2 Partially meets, 3 Meets, 4 Exceeds, 5 Outstanding), each showing its rubric text in small type; a small marker on tile 3 reading "Ananya's self-rating"; a comment field for the manager; and an "Evidence summary · Drafted by AI" box with three bullets and citation chips, such as "Shipped checklist v1 to 20% of accounts; step-2 completion up 9% [1]" and "Blocked 6 days on data access, outside Ananya's control [3]". Below it, a collapsed card for the next goal and a completed card with a green "Rated: 4 Exceeds" pill.

Right (5 columns), a sticky "Evidence" panel with tabs Goal card, Wins, Blockers, Feedback, Self-appraisal. The Blockers tab is open and shows a large figure, "8 days blocked this cycle", labelled "Delays outside the employee's control", followed by the two blocker cards with dates and who resolved them. Below, "Kudos from others (6)" with two kudos previews in violet.
```

---

## HR screens

### 16. HR overview · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the HR overview dashboard for Sneha Iyer, HR Business Partner at Acme Labs (312 employees). Sidebar: HR navigation (Overview active, then Company goals, Review cycles, Calibration, People, Integrations, Settings). The persona card shows Sneha with an HR badge. Top bar title "Overview".

Row 1, full width: a "Mid-year review FY 2026–27" card with "Self-reviews due 27 Nov · Manager reviews due 11 Dec", two progress bars ("Self-reviews 40% (124 of 312)" and "Manager reviews 5% (17 of 312)") and a button "Send reminders in chat". Inside the card, a table "Completion by team" with the columns Team, People, Self-reviews, Manager reviews and Status, plus a "Remind" action on each row: Product 24 · 63% · 8% · On track; Engineering 104 · 30% · 2% · Behind (amber); Customer Success 60 · 45% · 7% · On track; Sales 76 · 28% · 3% · Behind (amber); Finance & Ops 34 · 50% · 9% · On track; People 14 · 93% · 29% · On track.

Row 2: four KPI cards with small trend lines: "Check-in participation 81% this week (+6 pts)"; "Average time to resolve a blocker 3.2 days (−0.8)"; "Goal health: 64% on track · 26% at risk · 10% off track" with a stacked bar; "Weekly mood 3.9 / 5".

Row 3, left 7 columns: "Where work gets stuck", a heatmap with rows for the teams raising blockers and columns for the teams they're waiting on (Data Platform, Engineering, Finance, Legal, IT). Cell shade shows the number of open blockers, and the cell "Product → Data Platform: 9" is highlighted.
Row 3, right 5 columns: a "Value this quarter" card: "≈1,240 hours saved on status updates (estimate)", "71% of milestones hit on time", "74% of employees recognized at least once".

A small muted footer: "Team-level data only. HR can't see private journal entries or raw check-in replies."
```

### 17. Company goals · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Company goals page, where HR and leadership set company goals and see how they cascade to teams. Sidebar: HR navigation with Company goals active, signed in as Sneha Iyer. Page title "Company goals · FY 2026–27", buttons "New company goal" (primary) and "Goal templates" (secondary).

Main (8 columns): an expandable tree list. Each company goal is a card with an owner, progress bar, status pill and the number of linked team goals.
1. "Grow ARR to ₹40 Cr by March 2027" · Owner: CEO · 58% · On track · 6 team goals. This one is expanded, with team goals indented under it and joined by connector lines: "Sales: Close ₹18 Cr in new business" (Sales Head, At risk); "Product: Cut new-customer time-to-value from 14 to 5 days" (Vikram Mehta, On track, 5 individual goals); "Customer Success: Raise net revenue retention to 112%" (CS Head, On track).
2. "Keep customer satisfaction above 4.5" · 4 team goals · collapsed.
3. "Make Acme a great place to work: engagement score 4.2+" · 3 team goals · collapsed.
Under the tree, a warning row with an amber chip: "2 teams have no linked goals yet: Finance & Ops, People", and a link "Nudge their managers".

Right (4 columns): a "Goal templates" card listing templates with usage counts ("Launch a feature · used 42 times", "Improve a metric · 37", "Customer outcome · 21", "Learning goal · 18") and a button "Create template". Below, a "Goal-setting progress" card: "Individual goals approved: 268 of 312 (86%)" with a progress bar, and "Waiting for manager approval: 19".
```

### 18. Review cycle setup · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design step 4 of the review cycle setup wizard for HR. Sidebar: HR navigation with Review cycles active, signed in as Sneha Iyer. Header: "New review cycle", with a horizontal stepper of five steps: 1 Basics, 2 Participants, 3 Reviews and form, 4 Rating scale, 5 Schedule and launch. Steps 1–3 show check marks and step 4 is active.

Main card (8 columns): title "Rating scale and rubric", helper text "Employees see this on every goal card from day one, not just at review time." A table of five levels, each row with a number badge, an editable label and an editable description:
1 Needs improvement: "Missed most of the goal's measures without a clear reason."
2 Partially meets: "Made progress but missed the target."
3 Meets: "Hit the target agreed in the goal card."
4 Exceeds: "Beat the target, or hit it early with strong quality."
5 Outstanding: "Exceptional results that changed outcomes for the team or company."
Below the table, three toggles: "Show the rubric on goal cards" (on); "Require a comment for ratings 1 and 5" (on); "Use a forced distribution (bell curve)" (off), with the muted note "Off by default. PMG shows the rating spread for calibration instead."

Right (4 columns): a summary of the earlier steps: Name "Mid-year review FY 2026–27"; Participants "312 employees · 6 teams"; Reviews "Self ✓ · Manager ✓ · Peer: off"; Form "Standard goal review". Below it, a preview card "How employees will see it" showing a mini goal card with the rubric. Footer buttons: "Back", "Save draft" and "Next: Schedule" (primary).
```

### 19. Calibration · P1

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Calibration page HR uses once manager reviews are in. Sidebar: HR navigation with Calibration active, signed in as Sneha Iyer. Page title "Calibration · Mid-year review FY 2026–27", with filters for team, level and manager, and a button "Export for calibration meeting".

Row 1, full width: "Rating spread by team", a set of 100% stacked horizontal bars, one per team, each split into ratings 1 to 5, with the whole company as the first reference bar (3% / 12% / 51% / 26% / 8%). The Sales bar shows 61% rated 4 or 5 and carries an amber flag, "Much higher than the company average". Engineering is close to the average.

Row 2, left 8 columns: "Worth discussing", a list of flags, each with "View people" and "Add to meeting agenda" buttons: "Sales: 61% rated 4+ vs 34% company-wide"; "Customer Success: no 5 ratings across 3 managers"; "2 people rated 2 had 10+ days blocked by other teams".
Row 2, right 4 columns: "Manager consistency", listing managers with a small dot plot comparing each one's average rating with the company average.

At the bottom, an info card: "No forced bell curve. Use the spread to start conversations. Managers can adjust a rating with a reason, and every change is logged."
```

### 20. People and org setup · P1

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the People page, where HR imports employees and assigns roles. Sidebar: HR navigation with People active, signed in as Sneha Iyer. Page title "People · 312", buttons "Import CSV" (primary) and "Add person".

At the top, an expanded import panel: a drag-and-drop area "Drop your CSV here" with a "Download template" link. Below it, a column-mapping step for the file "acme_employees.csv", showing the detected columns mapped with green checks: name → Name, email → Email, team → Team, manager_email → Manager, role → PMG role. A result line: "312 rows · 309 ready · 3 need attention (missing manager)", and a primary button "Import 309 people".

Below, a people table with search and filters (Team, Role, Status). Columns: Name (with avatar), Email, Team, Manager, PMG role (pills: Employee, Manager, HR admin), Chat connected (a check icon, or an amber "Not matched" chip), Status (Active / Invited). Show 8 rows, including Ananya Rao, Vikram Mehta and Sneha Iyer.

On the right: an "Org chart preview" card with a small tree (CEO → department heads → teams) showing headcounts.
```

### 21. Integrations and chat connection · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the Integrations page, where HR connects the company's chat tool and optional work tools. Sidebar: HR navigation with Integrations active, signed in as Sneha Iyer. Page title "Integrations".

Section 1, "Chat tool · required": a large card with a logo placeholder, "Slack workspace: acme-labs", a green "Connected" pill, "Matched by email: 304 of 312 people" with an amber link "8 not matched", "Last synced 5 min ago", and buttons "Manage" and "Disconnect". Next to it, a smaller muted card: "Microsoft Teams · Coming soon".
Under it, a "What PMG does in chat" list with a toggle on each row, all switched on: Weekly check-in (with a schedule selector "Thursdays, 10:00 AM"); Blocker requests; Kudos command (/kudos); Feedback requests and prompts; 1:1 and action reminders; Goal approvals; Review-cycle reminders.

Section 2, "Work tools · optional": a grid of integration cards, each with a logo placeholder, a one-line description and a "Connect" button: Jira ("Pre-fill check-ins with tickets you closed"); GitHub ("Pre-fill check-ins with merged work"); Google Calendar ("Find 1:1s automatically"); Google Sheets / Excel ("Two-way goal sync for teams that track goals in a sheet"); CRM ("Pull closed deals into wins"). Each card has the small note "Employees choose what to connect. PMG reads work items only, never activity."
```

---

## Pitch

### 22. Chat bot mockup · Pitch

```text
Style: Use the PMG design system from the UI kit for the PMG bot's message cards (teal buttons, violet for kudos, Inter font, 12px corners). The chat app around them should look neutral and generic, in light grays, with no real product names or logos.

Design a desktop mockup for a pitch deck that shows how PMG works inside a team chat app. Show three chat panels side by side, each labelled above in small caps: "Ananya's view", "Arjun's view" and "Vikram's view". Each panel is a direct-message conversation with the "PMG" bot, which has a teal rounded-square avatar.

Ananya's view:
1. PMG, Thursday 10:00 AM: "Hi Ananya, time for your weekly check-in. What moved? What's stuck? What's next?" plus a row of five emoji buttons labelled "How was your week?"
2. Ananya's plain-text reply in three short lines: checklist v1 is live for 20% of accounts; I need access to the events dashboard from Data Platform; A/B test next.
3. A PMG card, "Here's what I found": Progress → Launch onboarding checklist; Win → Step-2 completion up 9%; Blocker → Dashboard access, waiting on Arjun Nair, need by 24 Nov. Buttons "Looks right" (teal) and "Edit in PMG".
4. A violet card: "Karan Shah gave you kudos: For the clearest spec we've had this quarter. Added to your wins journal."

Arjun's view:
1. A PMG card, "Ananya Rao is blocked": "Need read access to the product events dashboard · Goal: Reduce onboarding drop-off · Need by 24 Nov", with buttons "Accept", "Need info" and "Not me".
2. A confirmation after Accept: "Thanks. Ananya can see you're on it. Clearing this counts toward your helped-others record."

Vikram's view:
1. A PMG card, "Rohan Das proposed a goal: Increase activation email click rate to 12%", with buttons "Approve", "Request changes" and "Open in PMG".
2. A PMG card, "Your 1:1 with Ananya is at 4:00 PM. Agenda: 1 blocker, 1 at-risk goal, 1 win.", with a button "Open agenda".
```

This mockup is for the pitch and for agreeing on the bot's wording. In the working prototype, the chat messages are built with the chat tool's own message components (Block Kit, for Slack).

---

## Goals page redesign (Phases 19–22 of the implementation plan)

These four screens use the real demo data in the app, not the Ananya story above. Demo date: Thursday 29 Oct 2026, Q4 2026 (1 Oct–31 Dec), Week 5 of 13. People: Aman Kumar (Associate Developer, Engineering, work comes from Jira), Venkatesh TR (his manager), Kanika Hirani (Sr. Manager, Product Marketing, number goals) and Nafeesath S (her report). The rule for every screen: an employee should never have to track many things. One line per goal, one number per goal, at most three "Needs you" items, and details only when clicked.

### 23. Goals · Work (Aman) · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for personal goals, wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the employee "My goals" page for Aman Kumar, Associate Developer in Engineering, on Thursday 29 Oct 2026. The page must feel light: an employee should understand it in five seconds and never feel there is a lot to track. Use lots of white space, no tables, no more than one number per goal, and hide details until clicked.

Sidebar: employee navigation (Home, Goals active, My work, Check-ins, Blockers, Wins, 1:1s, Feedback, Reviews, Chat). At the bottom, Aman's persona card with an Employee badge and three small icon buttons: Sign out, Privacy, Reset.

Page header: title "My goals", subtitle "Q4 2026 · Week 5 of 13". On the right, a segmented control "Work | Personal" (Work selected, with a briefcase icon; Personal has a small lock icon) and a primary button "+ Create a goal".

Block 1, full width, only if there is something: a slim "Needs you" strip with at most two items, each one line with one action:
- Violet sparkle icon: "It's Thursday and this week's milestone is at 0%. Is something in the way?" Buttons "Raise a blocker" (secondary) and "Not blocked" (tertiary).
- Amber clock icon: "Your Q4 plan is with Venkatesh for approval · sent Monday" with a tertiary link "View".

Block 2, left 8 columns: a card "This week · 26 Oct – 1 Nov". One row per quarterly goal (two rows). Each row: a small type icon, the quarterly goal in muted small text, this week's milestone as the main line, one status pill, one short progress text and one action button on the right.
- Project icon (flag). Goal: "Cross-chat memory recalls the right past chats". This week: "Every past chat has a summary memory can draw on". Pill: Behind (amber). Text: "1 of 3 tasks". Button: "Open tasks". A tiny chip under the line: "From Jira · SP0-615".
- Project icon. Goal: "Lead one design review this quarter". This week: "Write the memory gating design note". Pill: On track (green). Text: "Due Fri". Button: "Tick it off".

Block 2, right 4 columns: a "To-dos" card with a small lock icon and the caption "Only you see these. They don't change your progress." A one-line input "Add a to-do… (Enter)". Three items with round checkboxes:
- "Ask Kanav for staging DB access" with a tiny chip "SP0-1368"
- "Re-run the backfill on 10% of chats"
- "Book a slot for the design review" (done, struck through)
Below, muted: "2 carried over from last week".

Block 3, full width: section title "This quarter" with a small "Q4 2026 ▾" dropdown on the right. Two quarter cards side by side. Each card: the quarterly goal title, one big percentage, one status pill, and a strip of 13 small circles for the 13 weeks: filled green for done weeks, amber for behind, a teal ring for this week, light grey for weeks ahead. Under the strip, month labels Oct / Nov / Dec in tiny muted text. Footer: an approval line with an icon ("Approved by Venkatesh · 26 Oct", or amber "Waiting for Venkatesh") and a tertiary link "See the quarter".
- Card 1: "Cross-chat memory recalls the right past chats" · 38% · At risk · weeks 1–2 green, 3–4 amber, 5 current, 6–13 grey · "Waiting for Venkatesh".
- Card 2: "Lead one design review this quarter" · 20% · On track · week 5 current, rest grey · "Approved by Venkatesh · 12 Oct".

At the very bottom, a muted single line: "PMG plans your weeks from Jira. You only check them." No other sections: no monthly cards, no feature lists, no history tables.
```

### 24. Goals · a week opened (Aman) · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for personal goals, wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Show the same "My goals" page for Aman Kumar (Thursday 29 Oct 2026) in the state after he clicks week 6 on the "Cross-chat memory recalls the right past chats" quarter card. Keep the header, the "Needs you" strip and the "This week" card exactly as they were, but slightly dimmed above the fold.

The quarter card grows downwards in place (no new page, no modal). The week 6 circle gets a teal ring and a small pointer. Under the strip, a light-grey panel titled "Week 6 · 2 – 8 Nov" with the pill "Yet to start" and the milestone "A prototype proves relevant past conversation context can be found". Below it, the tasks for that week as two simple rows. Each row has a square checkbox, the task as an outcome sentence, and a small Jira key chip. On the right is a muted "Planned 2 Nov" date, and on hover two quiet links appear: "Blocked?" and "+ to-do".
- "A prototype proves relevant past conversation context can be found" · SP0-1367 · amber note "Moved from Oct Week 3"
- "Speed and database impact of memory lookups are known under load" · SP0-1368

Under the tasks, a single tertiary link "Open the full goal" and a close "×" in the panel corner. Nothing else on the page changes. The point of this screen is progressive disclosure: details appear only where the employee clicked.
```

### 25. Goals · Work (Kanika, number and keep-it-running goals) · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for personal goals, wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the "My goals" page for Kanika Hirani, Sr. Manager, Product Marketing, on Thursday 29 Oct 2026 (Q4 2026, Week 5 of 13). Use the same layout as Aman's goals page: header with "Work | Personal" and "+ Create a goal", a "Needs you" strip, a "This week" card on the left with a "To-dos" card on the right, and "This quarter" cards below. It should look calm and use as few numbers as possible.

"Needs you" (one item, because she is a manager): teal people icon, "Split your team's 1,200 leads between you and Nafeesath" with a primary button "Split target".

"This week · 26 Oct – 1 Nov", two rows:
- Number goal (icon: trending up). Goal: "Bring in 600 qualified leads this quarter". This week's line: "38 of 46 leads" with a thin progress bar right under it. Pill: On track (green). A small source chip: "Marketing tool · synced 10:00 (demo data)". No action button, because the number fills in by itself.
- Keep-it-running goal (icon: refresh). Goal: "Send the monthly product newsletter by the 3rd working day". This week's line: "Next check: Tue 3 Nov". Pill: Upcoming (slate). Button (secondary, small): "Done on time?". Show this button as disabled, with the hint "Opens on 3 Nov".

"To-dos" card: "Brief the agency on the November webinar" and "Pull October lead sources for Gayathri", with the same privacy caption as Aman's.

"This quarter", two cards:
- "Bring in 600 qualified leads this quarter": the big number "212 of 600" (not a percentage), a pill "On track", and the 13-week strip as small vertical bars instead of circles. Each bar's height shows the week's leads against a dotted target line at 46. Weeks 1–4 are filled, week 5 is partly filled, and weeks 6–13 are empty outlines. Footer: "Approved by Neha · 2 Oct".
- "Send the monthly newsletter by the 3rd working day": three large check circles labelled Oct, Nov and Dec. Oct is a green check ("Sent 2 Oct"), Nov is a teal ring ("Due 3 Nov"), and Dec is grey. Pill: On track. Footer: "Only needs you on the day".
```

### 26. Create a goal (simplified) · P0

```text
Style: Use the PMG design system from the UI kit: desktop web app at 1440px, Inter font, deep teal #0F766E as the primary color, violet #7C3AED only for personal goals, wins and kudos, white cards with 12px corners and a soft shadow on a #F8FAFC background, status pills with an icon and a text label, and the standard app shell with a 248px left sidebar and a 64px top bar.

Design the "Create a goal" page for Kanika Hirani, Sr. Manager, Product Marketing, on Thursday 29 Oct 2026. It must take under a minute: one short column of three steps on the left and a summary card on the right. No month option and no long forms.

Header: title "Create a goal", subtitle "For Q4 2026. Neha, your manager, approves work goals once; after that, only changes need her."

Top of the form: a segmented control "Work | Personal" with Work selected.

Step 1 "What kind of goal?", three large selectable cards in a row, each with an icon, a short title and one muted line:
- "Deliver something" (flag icon): "A launch, a project or a programme"
- "Move a number" (trending-up icon, selected, teal ring): "Leads, revenue, CSAT…"
- "Keep something running" (refresh icon): "Something that must happen on time, every time"
Under the cards, a tiny muted note with a sparkle: "Picked for Marketing. Change it if it doesn't fit."

Step 2 "What will you achieve this quarter?": a text input pre-filled with "Bring in 600 qualified leads this quarter". Below it, an AI suggestion box in light teal with the label "Drafted by PMG from your team goal 'Generate 1,200 qualified leads' · Review before saving" and the actions Use / Edit / Dismiss.

Step 3 "Target": three small inline fields: "600", unit "leads", and a dropdown "Even weeks" (other option "Build up to the end"). Under them, a preview row of 13 small bars, all the same height, captioned "≈ 46 a week · PMG fills the weekly numbers from your marketing tool". A tertiary link: "Fill them in by hand instead".

Right column summary card: a trending-up icon and "Number goal · Q4 2026", the goal text, "600 leads · 46 a week", and the line "Goes to Neha once. After that, you'll only hear about it if you fall behind." Primary button "Send to Neha", secondary "Save as draft".

Keep it spacious and friendly. Each step has a numbered teal circle. There is nothing else on the page.
```

## Follow-up prompts that often help

- "Use the same sidebar and top bar as the Home screen."
- "Add more white space between the cards and reduce the number of borders."
- "Make the status pills smaller and put the icon before the label."
- "Use realistic avatar photos instead of initials."
- "Show this screen at 1280px wide without changing the layout order."
- For the goals redesign: "Remove anything that isn't needed this week; move it behind a 'See the quarter' link." or "Make every row one line: goal, status, one action."
