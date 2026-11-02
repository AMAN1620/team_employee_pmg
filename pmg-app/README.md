# PMG prototype

Working prototype of PMG, the employee-first performance-management product from our hackathon. It covers employees, managers and HR in one app, with a chat bot for check-ins, blockers, kudos and approvals.

- Feature plan: [../PMG_Features.md](../PMG_Features.md)
- Build plan and status: [../PMG_IMPLEMENTATION_PLAN.md](../PMG_IMPLEMENTATION_PLAN.md)
- Screen designs (Stitch exports): [../stitch_pmg_prototype_screen_prompts/](../stitch_pmg_prototype_screen_prompts/)

## Run it

Needs Node 22.5 or newer (it uses Node's built-in SQLite) and nothing else: no database server and no API keys.

```sh
npm install
npm run dev          # http://localhost:3000
```

The demo company is created on first start in `data/pmg.db`. To start the demo over, run `npm run db:reset`, or click **Reset** at the bottom of the sidebar (it signs you out).

The people and reporting lines come from the company org chart (42 people). Anyone with direct reports gets the manager view, which shows their team and everyone below them.

Engineering's and Product's goals, milestones, blockers and wins come from the Jira epic [SP0-112 Simkey Phase 3](https://jobsforher.atlassian.net/browse/SP0-112). See [Real data from Jira](#real-data-from-jira).

## Signing in

PMG opens on a sign-in page (email and password). Five demo accounts exist, shown on the page with a **Use** button that fills the form:

| Person | Email | Password | Role |
|---|---|---|---|
| Aman Kumar | `aman@acmelabs.in` | `Aman@2026` | Employee (Associate Developer 2) |
| Venkatesh TR | `venkatesh@acmelabs.in` | `Venkatesh@2026` | Aman's manager |
| Kanika Hirani | `kanika@acmelabs.in` | `Kanika@2026` | Sr. Manager, Product Marketing (manager view) |
| Priya Kumari | `priya@acmelabs.in` | `Priya@2026` | Associate Software Engineer |
| Rupam Mishra | `rupam@acmelabs.in` | `Rupam@2026` | Sr. QA Engineer |

Passwords are stored as salted scrypt hashes (`accounts` table), and the session is a cookie signed with a key kept in `data/.session-secret` (or `PMG_SESSION_SECRET`), so it can't be edited to become someone else; it lasts 7 days. **Sign out** is at the bottom of the sidebar. To add someone, add them to `DEMO_ACCOUNTS` in `lib/auth.ts` and reset the demo data. Nobody else has an account yet, so steps 1–7 of the demo below (HR, Anshika, Muru, Poonam) can't be clicked through by hand any more; `npm run smoke` still walks them by signing those people in with a test session. "Sign in with company account" is a placeholder for Google Workspace sign-in.

## Demo script (about 5 minutes)

The demo runs on the fixed date Thursday 29 Oct 2026, the day the Jira data was pulled, so live Jira and the demo agree on what "this week" is.

1. **Priyadarshini (HR)** → *Company goals*: create a company goal. *Review cycles* shows the rating rubric that appears on every goal card.
2. **Anshika** → *Goals → Create a goal*: pick **A quarter** and type "Improve the onboarding experience". The goal check flags it, so click **Use suggestion**, then **Send to Muru**. **Muru** → *Chat*: **Approve**.
3. **Anshika** → *Chat*: answer the check-in card. PMG sorts the reply into progress and a win on her Phase 3 goal, unplanned work, and two new blockers (one for Kanav, one for Customer Success). Click **Looks right**.
   Sample reply. What moved: "The Dream Sports B2B instance is live with all 3 domains and CleverTap events now carry company_id, which improved B2B tracking. Also helped Venkatesh pull cohort data for user calling." What's stuck: "Still waiting on Kanav for the B2B dashboard data pipeline. I also need the support-ticket export from Customer Success to plan the next Simkey release."
   Her chat also holds the three Phase 3 issues on hold waiting on her as product owner (SP0-586, SP0-612, SP0-791).
4. **Poonam** → *Chat*: the blocker request arrives with Accept / Need info / Not me. Accept it, then **Mark resolved**. Anshika's Phase 3 goal now shows the blocker resolved and the days blocked, and Poonam's wins show "Cleared Anshika's blocker".
5. **Aman** → *Chat*: `/kudos @anshika for the crisp B2B pilot walkthrough`. It lands in Anshika's wins journal.
6. **Muru** → *Team*: goal health, blockers and "Needs your attention", where Suchitra's Phase 3 goal is at risk with 27 issues on hold. Switch to *Whole org* to see progress rolled up through every leader, then open Suchitra's team and drill down to Kanav and Venkatesh. *1:1s* shows an agenda that built itself from Anshika's new blockers; add an action item.
7. **Anshika** → *Reviews*: **Draft my self-appraisal**. Every sentence cites its source; click a number to see it. Tick "reviewed" on each section, save, then submit. **Muru** → *Reviews*: rate with the evidence and days blocked beside the form, then submit. **Priyadarshini** → *Overview*: completion by team updates.

8. **Aman** → *Goals*: he never writes goals. October's Weeks 1 to 5 run across the top. Weeks 3 and 4 are Due, because four "Across Chat Memory" tasks slipped. PMG re-planned them into November's Weeks 1 and 2, so the feature, due 30 Oct by its story points, is now expected 11 Nov. Below are October's features and Q4, with what was accomplished in October (Web search, done 1 Oct) on the right. Use the Quarter and Month filter to go back to any month since June. *My work* shows the tickets, how each feature is sized, and **Sync now**. Back on *Goals*, click **Ask Venkatesh to approve** on Week 5. **Venkatesh** → *Chat*: **Approve**. Then *Team → Aman*: pick November, Week 1, **Edit and approve** to reword it, or **Set a goal for Aman this week**.
9. **Aman** → *Goals → Personal*: a quarter goal ("Get comfortable with system design interviews") broken into October and November, with October's weeks and their steps. Progress rolls up, and nobody else sees it. **Create a goal** for this week: no approval. Back on *Work*, **Create a goal** for November and **Send to Venkatesh**; **Venkatesh** → *Chat*: **Approve**. On the November goal, **Add a weekly goal**: it's covered by the approved month, so it's set straight away.
10. **Aman** → *Goals*: PMG asks "Is something in the way?" about Week 5. **Raise a blocker**: People and dependencies, tag Kanav and the Customer Success team, add what's needed, and open the drafted email. On *Blockers*, open "Details, messages and reminders" to see the mocked Slack and email and the reminder schedule. **Gayathri** → *Blockers → Waiting on me*: **Pass it on** to Poonam. Back as Aman, **Request a 1:1** with Kanav.

*Chat → Demo: three views* shows Anshika's, Kanav's and Muru's chats side by side, for the pitch.

## Tests

```sh
npm test             # 73 unit and integration tests (Vitest, in-memory database, no network)
npm run build        # type check and production build
npm run db:reset && npm run smoke   # walks the whole demo in Chrome (needs `npm run dev` running)
```

`npm run smoke` drives the installed Google Chrome through playwright-core and checks 45 steps, including sign-in and one live Jira sync. With an Anthropic key the server words check-ins and new goals with Claude, so allow a minute or two. To save a screenshot of each step, set `PMG_SHOTS=/some/folder`.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | When set, check-in sorting, self-appraisal drafts and planned-goal wording use Claude (`claude-opus-5-5`). `anthropic_api_key` in `.env` here or in the folder above also works. If it's unset, or any call fails, PMG uses its built-in rules. |
| `PMG_AI` | unset | Set to `rules` to force the built-in rules even with a key. |
| `PMG_DEMO_DATE` | `2026-10-29` | The "today" the whole app uses. |
| `JIRA_EMAIL`, `JIRA_API_TOKEN` | unset | Jira account and API token for syncing tickets. `jira_email` / `jira_token` in `.env` here or in the folder above also work. |
| `JIRA_SITE` | `https://jobsforher.atlassian.net` | Jira Cloud site. |
| `PMG_SYNC` | on | Set to `off` to stop the 15-minute Jira sync while the server runs. |
| `PMG_DB_PATH` | `data/pmg.db` | SQLite file. |
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | unset | Turns on the Slack bridge (below). |
| `PMG_SLACK_USERS` | unset | Maps demo personas to real Slack users, e.g. `anshika:U012AB3CD,muru:U045EF6GH`. Without it, people are matched by email. |

## Slack (optional)

Without Slack, everything works in the built-in chat (the *Chat* page). To use a real Slack workspace:

1. Create a Slack app from this manifest (api.slack.com/apps → Create New App → From manifest):

   ```yaml
   display_information:
     name: PMG
   features:
     bot_user:
       display_name: PMG
     app_home:
       messages_tab_enabled: true
       messages_tab_read_only_enabled: false
   oauth_config:
     scopes:
       bot: [chat:write, im:write, im:history, users:read, users:read.email]
   settings:
     event_subscriptions:
       bot_events: [message.im]
     interactivity:
       is_enabled: true
     socket_mode_enabled: true
   ```

2. Install it to the workspace and copy the bot token (`xoxb-…`). Under *Basic Information → App-Level Tokens*, create a token with `connections:write` (`xapp-…`).
3. Run the web app and the bridge side by side:

   ```sh
   export SLACK_BOT_TOKEN=xoxb-… SLACK_APP_TOKEN=xapp-…
   export PMG_SLACK_USERS="anshika:<your Slack user id>,muru:<teammate's id>,poonam:<…>"
   npm run dev
   npm run slack
   ```

The bridge posts every PMG bot message as a Slack DM with the same buttons. The check-in opens a Slack modal, and typed `/kudos @name …` or `/blocker @name …` DMs work as they do in the built-in chat. Socket Mode means it runs from a laptop with no public URL.

The Slack bridge hasn't been tested against a live workspace yet. Its Block Kit output is unit-tested, and it uses the same handlers as the built-in chat, which the smoke test covers.

## What's real and what's mocked

Real: every P0 feature in the demo script, plus feedback requests, goal alignment, privacy settings, people CSV import (try `public/acme_employees_sample.csv`) and the Slack bridge.

Real data: Engineering's and Product's goals, milestones, blockers and wins (from Jira, below), and Aman's weekly, monthly and quarterly goals, synced live from Jira.

Seeded or mocked: other teams' goals, everyone's check-in history and moods, 1:1s, the org-wide numbers for the 300 people who aren't modelled individually (HR KPIs, the heatmap baseline, the calibration spread, estimated hours saved), work-tool integrations other than Jira (GitHub and others are cards only), voice check-ins and real login.

## Real data from Jira

`lib/db/jira/sp0-112.json` is a snapshot of epic SP0-112 (Simkey Phase 3) and its 221 child issues, pulled on 29 Oct 2026. `lib/db/phase3.ts` turns it into PMG data on every `npm run db:reset`, replacing the seeded goals, blockers and wins of the 15 people in it:

| Jira | PMG |
|---|---|
| The epic | Suchitra's Engineering team goal "Ship Simkey Phase 3": 149 of 221 issues Done |
| Issues assigned to an engineer (the Developer when unassigned) | One goal per engineer, each issue a milestone, ticked with its Jira resolution date |
| Issues where someone is Product Owner | One goal per product owner (Anshika, Utkarsh, Akriti, Salman), each issue a milestone |
| On Hold or With Product | A blocker from the assignee to the Product Owner, open since Jira moved it to that status |
| "is blocked by" link between two people | A resolved blocker, with credit for the person who cleared it |
| Done Features, Stories and Production Bugs | Wins for the assignee (and the Product Owner for Features and Stories), with the Jira issue linked |

Name matching is explicit in `JIRA_PEOPLE` and `JIRA_PRODUCT_OWNERS`; `npm test` fails if a refreshed snapshot brings in someone new. Left out on purpose:
- Backlog issues are left out of personal goals, since they aren't committed work. They still count in the team goal.
- The six issues on the shared "Product Simkey" account have no owner in PMG. Poornisha C (not on the org chart) is only the Developer on SP0-710, which is assigned to Suchitra, so it counts for Suchitra.
- SP0-900 is On Hold with no Product Owner, so it is an open milestone, not a blocker.
- Jira has no due dates on this work, so these goals end on 31 Dec 2026, the quarter end.
- Anand's only Phase 3 issue is in the Backlog, so he has no goals. Muru and Tharun aren't in the epic and keep their seeded goals.

To refresh, pull the epic again with the same fields (status, assignee, Developer, Product Owner, resolution date, due date, issue links, and the date each held issue entered its status) into the same JSON shape, then run `npm run db:reset`.

## Goals planned from work (Aman)

Employees don't write goals. PMG plans each person's weeks, features, months and quarters from the work they're given, an LLM words them as outcomes, and the manager approves each week. It works the same whether the work comes from a connector or is typed in by hand.

- **Where work comes from.** A *connector* fetches a person's tickets (`lib/connectors/`, Jira today; Linear, GitHub or Asana would be more of the same `Connector` type). People without one add work on *My work*, and it's planned the same way.
- **Sync.** The server syncs every connection on start and every 15 minutes (`instrumentation.ts`). *My work → Sync now* and `npm run jira:sync` do it on demand. Jira owns ticket status; PMG never writes to Jira.
- **Features** (`lib/planner/`). A parent ticket with sub-tasks (Feature, Story or Task) is a feature, and the person's sub-tasks are its tasks. A ticket without a parent is a feature of its own. On Hold work waits until it moves again.
- **Deadlines.** A feature's weeks start when it goes In Progress. It's due on its Jira due date when one is set. Otherwise it's due when its tasks add up to, worked one after another: 1 story point is 2 working days, and a task without points is 2 days (so 5 tasks make a 2-week plan).
- **Weeks.** Each task is planned to finish in a week, and a week's goal is the tasks due in it across features. Months and quarters roll the weeks up. Done tasks count in the week they were done. When open tasks slip past their week, PMG re-plans the rest from today (work in review first, Jira due dates kept). That can push the feature past its deadline, which the goal shows ("Due 30 Oct · now 11 Nov"). Past weeks keep what was planned, with notes like "Not done; now planned for Nov Week 1". Weeks are numbered within their month: a week belongs to the month its Thursday falls in, so a month has four or five.
- **Wording.** Claude (`claude-opus-5-5`) first turns each task into a milestone: what is true once it's done ("Every past chat has a summary memory can draw on" for "Backfill chat summaries for un-summarised chats"). The plan shows the milestone with the ticket key as a link, not the ticket title. A milestone is written once per ticket and again only if the ticket is renamed (`writeMilestones`). Claude then builds each week, feature, month and quarter goal from those milestones (`writePlanGoals` in `lib/ai/`). The dates all come from the rules, so a sync plans the same way every time. If Claude is off or fails, rule wording is used ("Move Across Chat Memory forward"). Drafts are reworded when their tasks change. Goals a person approved or edited never are.
- **Approval, week by week.** Past weeks are rebuilt as approved history. This week and the weeks ahead are drafts that both the employee and the manager can see. The employee clicks **Ask Venkatesh to approve** (one week, or all drafts at once), and Venkatesh gets an Approve / Request changes card in chat. He can also approve a draft directly, edit its wording first, or set a week goal himself on Aman's page (*Team → Aman*). Months, quarters and features follow the weeks and need no approval.
- **Changes mid-week.** A ticket that joins a week Venkatesh already approved is added to it as waiting, and he gets an Approve card for that ticket alone (also on *Approvals*). Tickets that move out are logged on the goal.
- **Goals page.** Two tabs: **Work** and **Personal**, each with **Create a goal**. On Work, a Quarter and Month filter picks the month (this month by default). Its weeks are on top as Week 1 to 4 or 5, each Done, Done late, In progress, Due or Yet to start. In the current month, earlier weeks whose tickets are still open come first, under "Still due from earlier". Below are the selected week's goal and tasks, the month with its features, and its quarter. What was accomplished that month is on the right.

### Blockers

Raise one from a goal (**Raise blocker**), from a milestone or task (**Blocked?**), from an overdue task, or from PMG's nudge when this week's goal is under halfway by Wednesday ("It's Thursday and your goal for Oct Week 5 is at 0%. Is something in the way?"). The nudge and overdue tasks also show at the top of *Goals*. Code: `lib/services/blockers.ts`, `components/blockers/`.

- **Kinds.** People and dependencies, Skills and knowledge, Tools and technology, Time and workload, Clarity and direction, Processes and approvals, Personal (absence, leave, commitments). People and dependencies asks who can unblock it: any mix of people and teams, or None (just tracked). Every other kind asks whether to tell your manager, someone else, or nobody yet, and uses a free-text description instead of sub-categories.
- **Fields.** What's stuck, who can unblock it, which goal (and task) it affects, what's needed, when it's needed by, and the detail.
- **Who gets it.** One request per person tagged. A team goes to its head (the member whose own manager is outside the team), who can **Pass it on** to someone in the team. Each request arrives in PMG chat with Accept / Need info / Not me.
- **Outside PMG (mocked).** PMG also drafts an email from what was typed (previewed in the form) and a message on the org's channel (Slack, Google Chat or email, chosen on *Integrations*). Nothing is sent: it's kept in an outbox and shown on the blocker under "Sent outside PMG".
- **Reminders.** To whoever can unblock it a day before it's needed, to the employee on the day ("is it resolved?" with **Yes, resolved** / **Still blocked: nudge**), and after that a prompt to escalate that waits for the employee's OK. The schedule is shown on each blocker; sending is mocked.
- **1:1.** **Request a 1:1** on a blocker asks the other person for 15 minutes (added to your next 1:1 if you already have one booked; the calendar invite is mocked).
- Blockers raised together show as one item with a row per person; **All resolved** closes them all. Days blocked still count on the goal.

### Goals people set themselves

Next to the goals PMG plans, anyone can set their own (`lib/services/goals.ts`, *Goals → Create a goal*).

- **Work or personal.** Work goals go to the person's manager (their lead) for approval. Personal (side) goals are set the same way but need no approval, and only their owner sees them: they're left out of `goalsFor`, so check-ins, 1:1s, reviews, the team page, HR counts and comments never show them.
- **A week, a month or a quarter.** Top-down: set a quarter goal, then **Add a monthly goal** inside it, and weekly goals inside the month. Bottom-up: set weekly goals first, then create a month goal and pick them to gather them into it (months into a quarter the same way). Weeks belong to the month their Thursday falls in. A week goal can have steps to tick off.
- **Progress** rolls up: a week follows its steps (or **Mark done**), a month is the average of its weeks, a quarter of its months (`lib/services/rollup.ts`).
- **Approval.** A work quarter or month goal is sent to the manager (or saved as a draft). A week inside an approved month or quarter is covered by it and set at once; one inside a goal that's waiting waits with it. Sending a goal sends the drafts inside it, and approving it approves them; asking for changes sends them back to drafts. Rewording an approved work goal sends it back for approval.

Aman is connected in the demo (`lib/connectors/seeded.ts`). `npm run jira:pull` saves his tickets to `lib/db/jira/work-items.json`, and `npm run plan:write` has Claude word his plan into `lib/db/jira/plan-words.json`, so `npm run db:reset` and the tests work offline. The running app then syncs live. To plan Venkatesh or Suchitra the same way, add their Jira account ids to `seeded.ts` and run both commands again.

## Layout

```
app/                 Next.js routes; (app)/ holds the signed-in screens, actions/ the server actions
components/          UI kit (ui/), shell (sidebar, logo), review citations, plan board (plan/)
lib/db               SQLite connection, schema, demo seed
lib/repo             typed queries
lib/logic            goal health, days blocked, 1:1 agenda, permissions
lib/ai               Claude adapter and rule-based fallback
lib/chat             chat adapter, commands, Slack bridge
lib/services         reads that combine data and logic (views.ts), all writes (mutations.ts), work sync and planning (work.ts)
lib/connectors       work-tool connectors (Jira) and the people seeded with one
lib/planner          feature plans and week, month and quarter goals from work items (index.ts: rules, store.ts: writes)
scripts/             db reset, browser smoke test, Slack bridge, Jira pull and sync, plan wording, screenshot helper
tests/               Vitest
```
