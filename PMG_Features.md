# PMG: Features We Will Build

*Hackathon feature plan · 28 October 2026*

PMG is a standalone performance-management product for employees, managers and HR, connected to the company's chat tool. This document lists the features we will build and why. Every feature traces back to the "What this implies for PMG" column in Sheet12 of our team workbook, and to the findings behind it:

- **Survey 1** (32 responses) and **Survey 2** (22 responses). Percentages use each survey's applicable respondents, not all 54 submissions.
- **Interviews** with Manoj (SLK Group), John (HP), Rahul and Akshay.
- **Online research** in the Goals Research sheet: goal setting, feedback, recognition, Indian workplaces and remote work.
- **Competition study** of Peoplebox, Keka and SAP SuccessFactors.

## How to read this

Each feature has an ID, who uses it, a priority and the feature rule it meets.

**Priority**

- **P0:** in the prototype demo; must work end to end.
- **P1:** build once P0 works.
- **P2:** later; show as a mock screen or mention in the pitch.

**Feature rules** (from our Product features sheet). Every feature must do at least one of these:

- **Save time:** automate work employees do manually today.
- **Help achieve outcomes:** give guidance that makes meaningful progress more likely.
- **Remove friction:** help resolve blockers, clarify expectations or get support.
- **Create lasting value:** keep achievements and learnings employees can reuse.

Any information PMG asks an employee for must give them a benefit they can see.

## Design principles

1. **One check-in, many outputs.** Too much updating is our #3 pain point, so PMG can't add more forms. The weekly check-in is the main input, and PMG turns it into goal progress, blockers, wins, the 1:1 agenda and the review draft.
2. **Everyday actions happen in chat.** Rahul worried another application would add overhead. Check-ins, blockers, kudos and reminders happen in the chat tool; the web app is for seeing the full picture and planning.
3. **The employee owns their record.** Journal entries are private by default. Nothing AI drafts is saved or shared until the employee confirms it.
4. **No surveillance.** No keystroke, screen, webcam, location, online-status or hours tracking. A meta-analysis cited in our Goals Research found no evidence that electronic monitoring improves performance, and it was linked to higher stress. Goals, milestones and outcomes are the performance record.
5. **Light enough for companies under 500 employees.** Research on mid-sized Indian firms found low adoption of formal appraisal systems, so PMG has to work without an HR-tech team: templates, sensible defaults and CSV import.
6. **Keep what already works.** Rahul's team finds its shared Excel workflow effective. Where a team's current way of working works, PMG connects to it instead of replacing it.
7. **Transparency, not a fairness guarantee.** PMG makes goals, criteria and evidence visible. It can't guarantee fair ratings or remove bias, and we won't claim it does. AI can summarize evidence, but people make the ratings.

## At a glance: features by role

| Area | Employee | Manager | HR |
|---|---|---|---|
| Check-ins | Weekly check-in in chat (3.1, 3.2) | Team view (S.5) | Participation (S.11) |
| Goals | Goal card, health, milestones (4.1, 8.1, 8.2) | Approves goals and changes (4.1, 4.3) | Company goals and templates (S.4) |
| Blockers | Flag, route, days blocked (1.1–1.3) | Escalations, team blockers (1.4, S.5) | Where work gets stuck (S.11) |
| Recognition | Wins journal, kudos (2.1, 9.1, 9.2) | Monthly highlights (2.2) | Recognition spread (S.11) |
| Feedback | Ask for feedback (6.1) | Feedback prompts (6.2, 6.3) | How often feedback happens (S.11) |
| 1:1s | Agenda, actions (7.1, 7.2) | Agenda, actions, reminders (7.1–7.3) | — |
| Reviews | AI self-appraisal draft (5.1) | Rates with evidence beside it (4.4, S.8) | Cycles, rubric, progress, calibration (S.6, S.7, S.9, S.10) |
| Setup | Privacy and recognition settings (S.2, 9.1) | — | Org import, roles, chat connection (S.1–S.3) |

## Features by pain point

### 1. Blockers and dependencies (Helpless)

> "My progress gets delayed because blockers and dependencies aren't resolved when I need them to be."

**Evidence**

- Survey 1: 23/32 (72%) experienced unresolved blockers at least sometimes. Survey 2: 13/22 (59%) identified a blocker-resolution challenge.
- Interviews: little direct evidence about unresolved cross-team blockers.
- Research: monitoring goal progress promotes goal attainment (Harkin et al., 2016), which supports this only indirectly. Task interdependence raises coordination demands in teams.

**What this implies for PMG:** Surface blockers early, identify resolution owners, enable escalation and track resolution without creating another reporting burden.

**Features**

- **1.1 Blocker flag** *(Employee · P0 · Remove friction)*: The employee raises a blocker from the weekly check-in, a goal page or a chat command: what's stuck, who they're waiting on, when they need it by and which goal it affects. AI also spots blockers in check-in text ("still waiting on IT for access") and asks the employee to confirm.
- **1.2 Route to the resolver** *(Employee, any colleague · P0 · Remove friction)*: The person who can fix it gets a request in chat with three buttons: Accept, Need info, or Not me (with a suggestion of who). The employee and the goal page show the status as it changes.
- **1.3 Days-blocked record** *(Employee, Manager · P0 · Create lasting value)*: When a blocker closes, the time it was open stays on the goal: "Blocked 9 days waiting on vendor access." Managers see this during reviews, so delays outside the employee's control aren't held against them.
- **1.4 Escalation** *(Employee, Manager · P1 · Remove friction)*: If a blocker passes its need-by date, PMG suggests escalating, first to the employee's manager and then to the resolver's manager. The employee confirms each step; nothing escalates without them.

### 2. Contributions aren't visible (Invisible)

> "My hard work and contributions aren't always visible to the people evaluating my performance."

**Evidence**

- Survey 1: 20/32 (63%) reported unnoticed contributions. Survey 2: 14/22 (64%) reported the same.
- John: managers with many direct reports may not see all contributions. Manoj: support-function work is often noticed only when something goes wrong.
- Research: in nearly 12,000 daily diary entries, progress in meaningful work was the most common trigger of positive emotion and motivation, present on 76% of employees' best days versus 25% of their worst (Amabile & Kramer, 2011).

**What this implies for PMG:** Create an employee-controlled record of meaningful work, outcomes and evidence that can inform ongoing manager conversations.

**Features**

- **2.1 Wins journal** *(Employee · P0 · Create lasting value)*: A running record of wins, added from the check-in, from chat or in the web app, with a link, file or screenshot as proof. AI tags each win to the goal it supports. Entries stay private until the employee shares them with their manager, team or company.
- **2.2 Monthly highlights** *(Employee, Manager · P1 · Save time)*: Once a month PMG drafts a "top 3 wins" note from the journal. The employee edits it and sends it to their manager before their 1:1, which helps managers with large teams see work they'd otherwise miss.
- **2.3 Impact wording** *(Employee · P1 · Save time)*: AI suggests outcome-focused wording for a win, such as "restored billing for 40 clients" instead of "fixed the billing bug." The employee accepts, edits or ignores it.
- **2.4 Progress celebrations** *(Employee · P2 · Help achieve outcomes)*: When a milestone ships or a blocker is cleared, PMG can post a short celebration to the team channel, if the employee opts in.

### 3. Too much time on updates (Frustrated)

> "I spend too much time documenting and updating my work instead of actually doing it."

**Evidence**

- Survey 1: 22/32 (69%) reported repeated updates. Survey 2: 16/22 (73%) reported excessive progress-update effort.
- Rahul: worried another application would add overhead. Manoj: stressed ease of use and integration, and said documentation is hard for junior and non-desk staff.
- Research: only 12% of respondents in Indian organisations thought their performance-management system was highly effective (PwC, 2016). A vendor case study (Empxtrack) describes manual goal and appraisal sheets taking up employee time; treat it as vendor-reported.

**What this implies for PMG:** Reuse work information from existing tools, minimize duplicate entry and generate employee-reviewed updates automatically where feasible.

**Features**

- **3.1 Weekly check-in in chat** *(Employee · P0 · Save time)*: Once a week the PMG bot asks in chat: What moved? What's stuck? What's next? It also asks an optional "How was your week?" on a 1–5 scale. The employee replies in plain text; there's no form to fill in and no new app to open.
- **3.2 AI sorts the check-in** *(Employee · P0 · Save time)*: AI turns the reply into progress on specific goals, blockers (1.1) and wins (2.1). The employee checks the result and confirms or fixes it before anything is saved or shared. The confirmed check-in then feeds goal health (8.1), the manager's team view (S.5), the 1:1 agenda (7.1) and the review draft (5.1), so nothing gets typed twice.
- **3.3 Status update from the check-in** *(Employee · P1 · Save time)*: One click turns the confirmed check-in into a status update the employee can post to a team channel or send by email, instead of writing a separate status report.
- **3.4 Pre-filled updates from work tools** *(Employee · P2 · Save time)*: If the employee connects work tools such as Jira, GitHub, their calendar, the CRM or Google Sheets, PMG pre-fills the check-in: "You closed 6 tickets and shipped X this week." PMG reads only the work items the employee connects, never activity data.
- **3.5 Voice check-ins** *(Employee · P2 · Save time)*: The employee can answer the check-in with a voice note in English or Hindi, and PMG transcribes and sorts it. This is for junior and non-desk staff, who find written updates hard.

### 4. Unclear or untrusted evaluation (Anxious)

> "I don't understand or trust how my performance will be evaluated."

**Evidence**

- Survey 1: 20/32 (63%) reported unclear rating criteria. Survey 2: 3/22 (14%) picked unclear evaluation criteria as their biggest appraisal challenge.
- John: concerns about organizational politics and fairness. Manoj: bell-curve limitations. Akshay: had an opaque appraisal process in the past.
- Research: CIPD (2016), *Performance Management: Could Do Better?* In a study of 2,224 Indian SME employees, goal congruity, transparency, participation, fairness and understandability were strongly related to effective appraisals (Kathiravan et al., 2016). Gallup recommends clearly defined goals with defined accountability for results.
- This also covers pain point 11, "I don't always know what success looks like for my goals" (Survey 2: 3/22), which is still being validated.

**What this implies for PMG:** Make goals, success measures, evaluation criteria and supporting evidence accessible throughout the performance cycle.

**Features**

- **4.1 Goal card** *(Employee, Manager · P0 · Remove friction)*: Every goal states the outcome, measure, target, deadline, owner, dependencies, and what "meets" and "exceeds" mean, using the company rubric (S.7). The employee drafts it, the manager approves it or asks for changes (in chat or the web app), and both see the same card all year.
- **4.2 Goal quality check** *(Employee, Manager · P1 · Help achieve outcomes)*: AI flags vague goals like "improve client satisfaction" and suggests a measurable version like "raise CSAT from 4.1 to 4.4 by March."
- **4.3 Goal change log** *(Employee, Manager · P1 · Remove friction)*: When a goal changes mid-cycle, PMG keeps the old version, the new one, the date and the reason. Reviews judge each period against the version that applied then. This also covers pain point 12, changing priorities.
- **4.4 Evidence beside the rating** *(Manager, Employee · P0 · Remove friction)*: During a review, the manager sees the employee's goal cards, wins, kudos, days blocked and feedback next to the rating form (S.8). After the review, the employee can see which evidence was considered.

### 5. Can't recall achievements at review time (Stressed)

> "I struggle to remember and demonstrate everything I've achieved when review time arrives."

**Evidence**

- Survey 1: 20/32 (63%) had difficulty recalling achievements. Survey 2: 14/22 (64%) reported the same.
- John: hard to recall and concisely show a year's work. Rahul: reconstructing achievements is overwhelming, especially work beyond core KRAs.
- Research: goals are more likely to be reached when progress is monitored and recorded (Harkin et al., 2016). The link to review-time recall is indirect; our surveys and interviews are the stronger evidence here.

**What this implies for PMG:** Build a continuous achievement history and help employees create accurate, evidence-backed performance summaries with minimal manual effort.

**Features**

- **5.1 AI self-appraisal draft** *(Employee · P0 · Save time)*: One click drafts the self-review in the company's review form. Every sentence links to the win, check-in, resolved blocker or feedback it came from, so the manager can check it and nothing is invented. The employee edits and submits it; PMG never submits for them.
- **5.2 Achievement timeline** *(Employee · P1 · Create lasting value)*: Every confirmed check-in, win, resolved blocker, kudos and piece of feedback on one timeline, filterable by goal or quarter and exportable as a PDF the employee keeps.
- **5.3 Monthly recap** *(Employee · P1 · Save time)*: At the end of each month PMG drafts "your month": goals moved, wins, blockers cleared and feedback received. The employee confirms it, so the annual review builds on 12 confirmed recaps instead of memory.

### 6. Feedback comes too late (Unsupported)

> "I don't receive timely feedback or guidance when I need help improving my work."

**Evidence**

- Survey 1: 14/32 (44%) reported delayed feedback. Survey 2: 12/22 (55%) reported untimely feedback.
- Akshay: little structured feedback in a previous organization. Rahul: regular manager feedback has been a positive experience, which is the pattern to copy.
- Research: Gallup (2019), *Feedback Is Not Enough*, and CIPD (2022), *Performance Feedback: An Evidence Review*. Gallup reports only 22% of employees strongly agree they received meaningful feedback in the last week. CIPD found the largest performance effects when immediate feedback was combined with progress monitoring. In Indian IT multinationals, employees rated goal setting and continuous feedback as the most positive parts of their performance systems (Tripathi et al., 2021).

**What this implies for PMG:** Support contextual feedback, guidance requests and timely manager intervention connected to actual goals and work.

**Features**

- **6.1 Ask for feedback** *(Employee · P1 · Remove friction)*: From a goal or a win, the employee asks a manager or peer for feedback on one specific piece of work, with a due date: "Can you review my client deck by Friday?" The request arrives in chat and the reply is saved on that goal.
- **6.2 Milestone feedback prompts** *(Manager · P1 · Help achieve outcomes)*: When an employee completes a milestone or clears a blocker, the manager gets a chat prompt to give quick feedback using a simple template: one thing to keep doing, one thing to improve, and a next action with an owner and due date.
- **6.3 Check-in suggestions for managers** *(Manager · P1 · Remove friction)*: When a goal turns At risk (8.1) or a blocker passes its need-by date, PMG suggests the manager checks in. This uses only what the employee has reported.

### 7. 1:1 actions aren't followed through (Ignored)

> "Actions agreed during manager 1:1s aren't consistently followed through."

**Evidence**

- Survey 1: 19/32 (59%) reported lost follow-up actions. Survey 2: 13/22 (59%) reported inconsistent follow-through.
- Interviews: little direct evidence about forgotten 1:1 commitments.
- Research: feedback interventions improve performance on average, but how much depends on where they direct attention. Gallup (2019) and CIPD (2022) support ongoing, actionable feedback, but don't measure how often 1:1 commitments are missed.

**What this implies for PMG:** Capture agreed actions, owners and follow-up dates; make outstanding commitments visible before subsequent conversations.

**Features**

- **7.1 1:1 agenda that builds itself** *(Employee, Manager · P0 · Save time)*: Before each 1:1, PMG builds a shared agenda from open action items, unresolved blockers, recent wins, goals at risk and any topics either person adds.
- **7.2 Action items** *(Employee, Manager · P0 · Remove friction)*: Actions agreed in the 1:1 are saved with an owner, a due date and the goal or blocker they relate to. Both people see the same list.
- **7.3 Follow-up reminders** *(Employee, Manager · P1 · Help achieve outcomes)*: Chat reminders before each action is due, for both people, including what the manager committed to. Open actions carry into the next agenda until they're closed.
- **7.4 Actions from meeting notes** *(Employee, Manager · P2 · Save time)*: Paste meeting notes or a transcript, and AI pulls out the action items for both people to confirm.

### 8. Can't tell whether goals are on track (Uncertain)

> "I can't easily tell whether I'm making enough progress toward achieving my goals."

**Evidence**

- Survey 2: 11/21 applicable respondents (52%) found it hard to know whether their goals were on track. Survey 1 didn't ask this.
- Akshay: no direct access to personal performance data. John: wants delivery and performance systems better connected.
- Research: across 138 studies, monitoring goal progress promoted goal attainment, more strongly when progress was recorded and made public (Harkin et al., 2016). If-then plans help turn intentions into action. Among Indian respondents, 77% knew their company's goals but only 60% had regular monthly goal-progress discussions (People Business study, 2015).

**What this implies for PMG:** Show meaningful progress against success measures and milestones, highlight risks early and recommend useful next actions.

**Features**

- **8.1 Goal health** *(Employee, Manager, HR · P0 · Help achieve outcomes)*: Each goal shows On track, At risk or Off track, with the reason in plain words: "40% done with 70% of the quarter gone; 1 open blocker."
- **8.2 Milestones** *(Employee, Manager · P1 · Help achieve outcomes)*: AI helps split a goal into dated milestones. Progress is the share of milestones done, not a percentage typed from memory, and each goal keeps a visible trail of milestone status, evidence, blockers and last update.
- **8.3 Next steps and recovery plan** *(Employee · P1 · Help achieve outcomes)*: When a goal slips, AI suggests one or two concrete next steps and helps the employee write a short if-then plan: "If the vendor misses Friday, I'll switch to the backup supplier."
- **8.4 Goal alignment** *(Employee · P1 · Remove friction)*: Shows how the employee's goal connects to their team's goal and the company goal (S.4), and lets them mark their own contribution.

### 9. Teamwork and behind-the-scenes work overlooked (Overlooked)

> "My collaboration, additional responsibilities and behind-the-scenes contributions aren't adequately recognized."

**Evidence**

- Survey 2: 12/21 applicable respondents (57%) said teamwork wasn't recognized.
- Manoj: support-function contributions are hard to quantify, and unplanned facilities work doesn't fit structured goals. John: contributions outside highly visible work can go unrecognized.
- Research: among 121 US small-business employees, feedback and recognition was the only performance-management factor that stayed significant in explaining engagement. In one experiment, public recognition only produced more effort than private recognition when employees had strong bonds with their managers.

**What this implies for PMG:** Capture meaningful contributions beyond formal goals, including teamwork and unplanned responsibilities, without requiring extensive self-reporting.

**Features**

- **9.1 Kudos in chat** *(Everyone · P0 · Create lasting value)*: Type `/kudos @name for ...` in chat, or use the kudos button in the web app. The kudos lands in the recipient's wins journal (2.1) as evidence from someone else, so they don't have to self-report it. Each person chooses how they like to be recognized: privately with their manager, in front of their team, or company-wide.
- **9.2 Resolver credit** *(Everyone · P0 · Create lasting value)*: When someone clears another person's blocker (1.2), PMG adds it to the resolver's journal automatically: "Cleared a teammate's access blocker in 1 day." Helping others becomes visible work, which gives people a reason to unblock colleagues quickly.
- **9.3 Unplanned work tag** *(Employee · P1 · Create lasting value)*: In the check-in, the employee can tag work as unplanned, support or helping others. It shows up at review time even though it isn't part of a formal goal. This also covers pain point 12, unexpected work.
- **9.4 Shared-goal contributions** *(Employee, Manager · P2 · Create lasting value)*: On team goals, each person's part is recorded and confirmed by the others on the goal, so a shared win isn't credited to one name.

### 10. Everything is scattered (Disconnected)

> "My goals, progress, feedback and achievements are scattered across different tools and conversations."

**Evidence**

- Survey 1: 26/32 used notes, spreadsheets, project tools or email/chat as their main tracking method. Survey 2: 10/22 used project tools and 8/22 used Excel or personal notes. This shows tool use, not necessarily dissatisfaction.
- John: evidence is spread across multiple tools. Manoj: wants integration with existing systems. Rahul: the team's shared Excel workflow works well.
- Research: vendor case studies (Empxtrack, Phi EDGE) describe manual, fragmented processes. Independent evidence of this as an employee pain point is limited.

**What this implies for PMG:** Connect relevant goal, work, feedback and achievement information into a coherent employee experience without replacing workflows that already work.

**Features**

- **10.1 My Performance home** *(Employee · P0 · Save time)*: One screen with the employee's goals and their health, open blockers, recent wins and kudos, feedback, 1:1 actions and the next review date.
- **10.2 Save to PMG** *(Employee · P1 · Save time)*: Forward an email, or use a message action in chat, to save something as a win or as feedback without leaving the conversation.
- **10.3 Spreadsheet sync** *(Employee, Manager · P2 · Save time)*: Two-way sync with Google Sheets or Excel for teams that already track goals in a shared sheet, so they can keep working that way.

## Standalone platform features

These don't come from a single pain point. PMG needs them to run on its own, and Peoplebox, Keka and SuccessFactors all offer them. Our four feature rules were written for employee-facing features, so these list only who uses them and their priority.

- **S.1 Organization setup** *(HR · P1)*: HR imports employees from a CSV (name, email, team, manager, role), and PMG builds teams and reporting lines from it. The prototype uses a seeded demo company instead.
- **S.2 Roles, permissions and privacy** *(Everyone · P0)*: Three roles: Employee, Manager and HR admin. Employees own their journal and check-ins, managers see what their reports share, and HR sees team-level numbers and submitted reviews, not private journal entries or raw check-ins. The prototype uses a role switcher instead of real login.
- **S.3 Chat tool connection** *(HR · P0)*: HR connects the company's chat workspace once, and PMG matches people by email. Everything in "What happens in chat" below runs through this.
- **S.4 Company goals and templates** *(HR, Manager · P0)*: HR or leadership sets company goals, managers add team goals under them, and employees link their goals to a team goal. Goal templates by role give each team a starting point. Research on 30 Indian SMEs found goal setting was applied irregularly and managers had little training in it, so templates make PMG less dependent on each manager's skill.
- **S.5 Manager team view** *(Manager · P0)*: One screen per team showing each person's goal health, open blockers (including ones waiting on the manager), last check-in, recent wins and next 1:1.
- **S.6 Review cycles** *(HR · P0)*: HR sets the cycle dates, who takes part, which reviews are included and the review form. Self and manager reviews are P0; peer reviews are P1. PMG sends the reminders in chat.
- **S.7 Rating scale and rubric** *(HR · P0)*: HR defines the rating scale and what each level means. The rubric appears on every goal card (4.1) from the start of the cycle, not just at review time.
- **S.8 Manager review** *(Manager · P0)*: The manager rates each goal against the rubric with the evidence panel (4.4) beside the form, adds comments and submits. AI can summarize the evidence but never suggests a rating.
- **S.9 Review progress** *(HR · P0)*: Shows who has finished self-reviews and manager reviews, by team, with one-click chat reminders for anyone behind.
- **S.10 Calibration view** *(HR · P1)*: Rating spread per team, with teams that rate unusually high or low flagged for discussion. There's no forced bell curve; Manoj raised bell-curve problems in the interviews.
- **S.11 HR insights and ROI** *(HR · P1)*: Company-wide goal health, check-in participation, how quickly blockers get resolved and which teams are blocked most, how often feedback is given, how recognition is spread, and the weekly 1–5 score. These give buyers the ROI our Value prop sheet asks for: goal completion, employee satisfaction and an estimate of hours saved on status updates.

## What happens in chat

| In chat | Who | Feature |
|---|---|---|
| Weekly check-in, reply and confirmation of what AI pulled out | Employee | 3.1, 3.2 |
| Blocker request with Accept / Need info / Not me | Resolver | 1.2 |
| Escalation suggestion | Employee | 1.4 |
| `/kudos @name for ...` | Everyone | 9.1 |
| Feedback request and milestone feedback prompt | Manager, peers | 6.1, 6.2 |
| Goal approval with Approve / Request changes | Manager | 4.1 |
| 1:1 reminder with the agenda, action-item reminders | Employee, Manager | 7.1, 7.3 |
| Review-cycle reminders | Everyone | S.6, S.9 |
| "Save to PMG" on any message | Employee | 10.2 |

## Prototype demo

The P0 features add up to one story that runs through all three roles:

1. **HR** creates a company goal (S.4) and launches a review cycle with a rating rubric (S.6, S.7).
2. An **employee** writes a goal under it (4.1), and their **manager** approves it in chat.
3. The **employee** answers the weekly check-in in chat (3.1). AI sorts it into goal progress, a blocker and a win, and the employee confirms (3.2).
4. The **blocker** goes to the person who can fix it (1.2). They resolve it in chat, the days blocked are saved on the goal (1.3) and the resolver gets credit (9.2).
5. A teammate sends `/kudos` (9.1), and it lands in the employee's wins journal (2.1) on their home screen (10.1).
6. The **manager** opens the team view (S.5): goal health (8.1), open blockers and a 1:1 agenda that built itself (7.1). They add an action item (7.2).
7. At review time, the **employee** clicks "Draft my self-appraisal" (5.1). The **manager** rates against the rubric with the evidence beside it (4.4, S.8), and **HR** sees review completion by team (S.9).

**For the prototype we will also:**

- Seed a demo company of about 15 people in 3 teams with a quarter of check-ins, wins, blockers and feedback. Without that history the dashboards look empty and the self-appraisal has nothing to cite.
- Show P2 features (work-tool updates, voice check-ins, spreadsheet sync) as mock screens.
- Use a role switcher instead of real login.

**Out of scope:** compensation and variable pay. Whether goals are linked to variable pay is still an open research question in our Value prop sheet.

## How PMG compares

Based on our competition study of Peoplebox, Keka and SAP SuccessFactors:

| | Competitors | PMG |
|---|---|---|
| Who drives it | HR runs review cycles; managers keep 1:1 notes and record achievements | The employee's weekly check-in and journal; managers and HR see what they produce |
| Blockers | Not covered for any of the three in our study | Routing, escalation, days-blocked record and resolver credit |
| AI | Goal drafting and summaries (Peoplebox); review drafting (SAP Joule) | Self-appraisal drafts where every line links to evidence the employee confirmed |
| Chat | Slack/Teams connections, but how much works inside chat is unconfirmed | Check-ins, blockers, kudos and approvals happen in chat |
| Calibration | 9-box grids (Peoplebox, Keka) and bell-curve tools (Keka) | Rating spread and outlier flags, no forced bell curve |

## Still to decide

- **Chat tool for the prototype.** Slack is the quickest to build on. Teams needs more setup: an Azure bot registration and a Microsoft 365 tenant that allows custom apps.
- **Build time and who's coding.** This decides how much of the demo runs live. With only a day or two, we'd keep demo steps 3, 4 and 7 live and show the rest with seeded data.
- **AI provider and API key.** Needed for every AI feature, starting with 3.2 and 5.1.
- **Pain points 11 and 12.** These are still marked "retained for validation" in the Revised Employee pain points sheet. Features 4.1, 4.3 and 9.3 cover them if they hold up.

## Sources

All source links (surveys, interview notes, the Goals Research doc and the competition folder) are in the **Ref docs** and **Survey** sheets of `Team employee.xlsx`. The evidence above comes from its Sheet12, Revised Employee pain points, Goals Research, Value prop & Pain Points, Competition study and Product features sheets.
