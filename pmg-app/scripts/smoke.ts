// End-to-end demo walk in a real browser (uses the installed Google Chrome).
// Run against a server with fresh demo data:  npm run db:reset && npm run dev  then  npm run smoke
import { chromium, type Page } from "playwright-core";
import { SESSION_COOKIE, signSession } from "../lib/auth";

const BASE = process.env.PMG_URL ?? "http://localhost:3000";
const SHOTS = process.env.PMG_SHOTS; // optional folder for screenshots
let step = 0;

// Only Aman and Venkatesh have passwords; the walk signs the other people in with a session signed by the same
// key the server uses (data/.session-secret), as a test harness on the same machine can.
async function as(page: Page, persona: string, path: string) {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: SESSION_COOKIE, value: signSession(persona), url: BASE, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

async function check(page: Page, name: string, text: string | RegExp) {
  step++;
  // Server actions re-render after the click resolves, so poll for the text for a few seconds.
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) {
    const body = await page.locator("main").innerText();
    ok = typeof text === "string" ? body.includes(text) : text.test(body);
    if (!ok) await page.waitForTimeout(200);
  }
  console.log(`${ok ? "✓" : "✗"} ${step}. ${name}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, "0")}-${name.replace(/\W+/g, "-").toLowerCase()}.png`, fullPage: true });
  if (!ok) throw new Error(`Expected "${text}" on ${page.url()}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    for (const s of SCRIPT) await s(page);
    console.log(`\nAll ${step} checks passed.`);
  } finally {
    await browser.close();
  }
}

const SCRIPT: ((p: Page) => Promise<void>)[] = [];
export function demo(fn: (p: Page) => Promise<void>) { SCRIPT.push(fn); }

// ── The demo (PMG_Features.md → Prototype demo) ──
// Sign-in: email and password; wrong ones are refused, an edited cookie is ignored, and signing out works.
demo(async (p) => {
  await p.goto(`${BASE}/goals`);
  await check(p, "signed-out visitors land on sign-in", "aman@acmelabs.in");
  await p.fill("input[name=email]", "aman@acmelabs.in");
  await p.fill("input[name=password]", "wrong-password");
  await p.click("button:has-text('Sign in')");
  await check(p, "wrong password refused", "don't match");
  await p.locator("li", { hasText: "aman@acmelabs.in" }).getByRole("button", { name: "Use" }).click();
  await p.click("button:has-text('Sign in')");
  await p.waitForURL(/\/home/);
  await check(p, "Aman signs in", "Aman");
  const [cookie] = await p.context().cookies();
  await p.context().addCookies([{ ...cookie, value: cookie.value.replace(/^aman\./, "venkatesh.") }]);
  await p.goto(`${BASE}/team`);
  await check(p, "an edited session cookie is ignored", "aman@acmelabs.in");
  await as(p, "aman", "/home");
  await p.click("button:has-text('Sign out')");
  await p.waitForURL(/signedOut=1/);
  await check(p, "signs out", "You're signed out");
});

// 1. HR creates a company goal; the review cycle is running with a rubric.
demo(async (p) => {
  await as(p, "priyadarshini", "/hr/goals");
  await p.fill("input[placeholder^='e.g. Expand']", "Expand to two new cities");
  await p.click("button:has-text('Create')");
  await p.waitForURL(/created=1/);
  await check(p, "HR creates a company goal", "Expand to two new cities");
  await as(p, "priyadarshini", "/hr/cycles");
  await check(p, "review cycle rubric", "Rating scale and rubric");
});

// 2. Employee drafts a goal; manager approves it in chat.
demo(async (p) => {
  await as(p, "anshika", "/goals/new");
  await p.click("button:has-text('A quarter')");
  await p.fill("input[name=title]", "Improve the onboarding experience");
  await check(p, "goal quality check flags a vague goal", "This goal is hard to measure");
  await p.click("text=Use suggestion");
  await p.click("button:has-text('Send to Muru for approval')");
  await p.waitForURL(/\/goals\/\d+\?created=1/);
  await check(p, "goal sent for approval", "Sent to Muru Arjunan for approval");
  await as(p, "muru", "/chat");
  const card = p.locator("div.rounded-lg", { hasText: "Anshika Goswami proposed a goal" }).last();
  await card.getByRole("button", { name: "Approve" }).click();
  await p.waitForLoadState("networkidle");
  await check(p, "manager approves in chat", "Approved");
});

// 3. Employee answers the weekly check-in in chat; PMG sorts it.
demo(async (p) => {
  await as(p, "anshika", "/chat");
  await p.fill("textarea[name=moved]", "The Dream Sports B2B instance is live with all 3 domains and CleverTap events now carry company_id, which improved B2B tracking. Also helped Venkatesh pull cohort data for user calling.");
  await p.fill("textarea[name=stuck]", "Still waiting on Kanav for the B2B dashboard data pipeline. I also need the support-ticket export from Customer Success to plan the next Simkey release.");
  await p.fill("textarea[name=next]", "Start the B2B pilot dashboard once the pipeline is ready.");
  await p.click("form:has(textarea[name=moved]) button:has-text('Send')");
  await p.waitForLoadState("networkidle");
  await check(p, "check-in sorted in chat", "Here's what I found");
  await p.getByRole("button", { name: "Looks right" }).click();
  await p.waitForLoadState("networkidle");
  await check(p, "check-in confirmed from chat", "Your goals, wins and blockers are updated");
});

// 4. The new blocker reaches Poonam in chat; she accepts and resolves it.
demo(async (p) => {
  await as(p, "poonam", "/chat");
  await check(p, "blocker request in Poonam's chat", "Anshika Goswami is blocked: Need the support-ticket export");
  await p.locator("div.rounded-lg", { hasText: "support-ticket export" }).last().getByRole("button", { name: "Accept" }).click();
  await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Mark resolved" }).last().click();
  await p.waitForLoadState("networkidle");
  await as(p, "anshika", "/goals?tab=weekly");
  await p.click("a:has-text('Take 26 Simkey Phase 3 issues')");
  await p.waitForURL(/\/goals\/\d+$/);
  await check(p, "days blocked recorded on the goal", "Resolved by Poonam Ramesh in 1 day");
  await as(p, "poonam", "/wins?filter=helped");
  await check(p, "resolver credit", /Cleared Anshika's blocker/);
});

// 5. A teammate sends /kudos; it lands in the journal.
demo(async (p) => {
  await as(p, "aman", "/chat");
  await p.fill("input[name=text]", "/kudos @anshika for the crisp B2B pilot walkthrough");
  await p.click("button[aria-label=Send]");
  await p.waitForLoadState("networkidle");
  await check(p, "kudos command", "Kudos sent to Anshika Goswami");
  await as(p, "anshika", "/wins?filter=kudos");
  await check(p, "kudos in wins journal", "The crisp B2B pilot walkthrough");
});

// 6. Manager's team view and the 1:1 agenda that builds itself.
demo(async (p) => {
  await as(p, "muru", "/team");
  await check(p, "manager team view", "Needs your attention");
  await as(p, "muru", "/one-on-ones?with=anshika");
  await check(p, "1:1 agenda auto-filled", "B2B dashboard data pipeline");
  await check(p, "1:1 agenda topics", "Path to Senior Product Manager");
  await p.fill("input[placeholder='Add an action…']", "Intro Anshika to the backend lead");
  await p.click("form:has(input[placeholder='Add an action…']) button:has-text('Add')");
  await p.waitForLoadState("networkidle");
  await check(p, "action item added", "Intro Anshika to the backend lead");
});

// 7. Self-appraisal drafted with citations → manager rates → HR sees completion.
demo(async (p) => {
  await as(p, "anshika", "/reviews/self");
  await p.click("button:has-text('Draft my self-appraisal')");
  await p.waitForURL(/drafted=1/);
  await check(p, "self-appraisal drafted with sources", "Every sentence links to its source");
  for (const box of await p.locator("input[type=checkbox][name^=reviewed], input[name=beyondReviewed]").all()) await box.check();
  for (const radio of await p.locator("input[type=radio][value='3']").all()) await radio.check({ force: true });
  await p.click("button[value=save]");
  await p.waitForURL(/saved=1/);
  await p.click("button[value=submit]");
  await p.waitForURL(/submitted=1/);
  await check(p, "self-appraisal submitted", "Submitted to Muru Arjunan");

  await as(p, "muru", "/reviews/manager/anshika");
  for (const radio of await p.locator("input[type=radio][value='4']").all()) await radio.check({ force: true });
  await p.click("button[value=save]");
  await p.waitForURL(/saved=1/);
  await check(p, "evidence beside the rating", "blocked this cycle");
  await p.click("button[value=submit]");
  await p.waitForURL(/\/reviews\?submitted=/);
  await check(p, "manager review submitted", "Review submitted");

  await as(p, "priyadarshini", "/hr");
  await check(p, "HR sees review completion", /Self-reviews \d+%/);
});

// 8. Aman never writes goals: PMG plans his weeks from Jira, he asks Venkatesh to approve, Venkatesh approves or edits.
demo(async (p) => {
  await as(p, "aman", "/goals?tab=weekly");
  await check(p, "weeks planned from Jira, this week drafted", "Ask Venkatesh to approve");
  await check(p, "overdue feature re-planned", "Due 30 Oct · now 11 Nov");
  await as(p, "aman", "/goals?tab=weekly&q=2026-07-01&m=2026-08-01");
  await check(p, "past months rebuilt from Jira", "Accomplished in August");
  await as(p, "aman", "/work");
  await check(p, "tickets synced from Jira", "Across Chat Memory");
  await p.click("button:has-text('Sync now')");
  await p.waitForURL(/synced=\d+/, { timeout: 120_000 });
  await check(p, "live Jira sync from the page", /Synced \d+ tickets/);
  await as(p, "aman", "/goals?tab=weekly");
  await p.click("button:has-text('Ask Venkatesh to approve')");
  await p.waitForURL(/done=requested/);
  await check(p, "Aman sends this week for approval", "Your manager gets it in chat");
  await as(p, "venkatesh", "/chat");
  await p.locator("div.rounded-lg", { hasText: "goal for Oct Week 5" }).last().getByRole("button", { name: "Approve" }).click();
  await p.waitForLoadState("networkidle");
  await check(p, "Venkatesh approves the week in chat", "Approved");
  await as(p, "venkatesh", "/team/aman?week=2026-11-02");
  await p.click("summary:has-text('Edit and approve')");
  await p.fill("input[name=title]", "Relevant-context PoC done and latency numbers shared");
  await p.click("button:has-text('Save and approve')");
  await p.waitForURL(/done=approved/);
  await check(p, "Venkatesh rewords and approves next week", "Relevant-context PoC done and latency numbers shared");
  await as(p, "aman", "/goals?tab=weekly");
  await check(p, "Aman sees both weeks approved", /Week 5[\s\S]{0,200}Approved/);
});

// 9. Goals people set themselves: a personal goal needs no approval; a work month goes to Venkatesh, and a week
// inside it is covered once he approves.
demo(async (p) => {
  await as(p, "aman", "/goals?tab=personal");
  await check(p, "personal goals: quarter, months and weeks", "Get comfortable with system design interviews");
  await p.click("a:has-text('Create a goal')");
  await p.fill("input[name=title]", "Run 5 km three times this week");
  await p.click("button:has-text('Create goal')");
  await p.waitForURL(/\/goals\/\d+\?created=1/);
  await check(p, "personal goal set without approval", "only you can see it and it needs no approval");

  await as(p, "aman", "/goals/new?kind=work&horizon=month&start=2026-11-01");
  await p.fill("input[name=title]", "Cross-chat memory recalls the right past chats in 3 of 3 staging tests");
  await p.click("button:has-text('Send to Venkatesh for approval')");
  await p.waitForURL(/\/goals\/\d+\?created=1/);
  await check(p, "work month goal sent for approval", "Sent to Venkatesh");
  const monthUrl = p.url().replace(/\?.*$/, "");
  await as(p, "venkatesh", "/chat");
  await p.locator("div.rounded-lg", { hasText: "proposed a goal for November 2026" }).last().getByRole("button", { name: "Approve" }).click();
  await p.waitForLoadState("networkidle");
  await check(p, "Venkatesh approves the month in chat", "Approved");
  await as(p, "aman", new URL(monthUrl).pathname);
  await p.click("a:has-text('Add a weekly goal')");
  await p.fill("input[name=title]", "Write the memory gating design note and review it with 2 teammates");
  await p.click("button:has-text('Create goal')");
  await p.waitForURL(/\/goals\/\d+\?created=1/);
  await check(p, "week inside an approved month is covered", "needs no separate approval");
});

// 10. Blockers: PMG nudges Aman about a week goal that's behind; he raises a blocker for Kanav and the Customer
// Success team (it goes to Gayathri, its head), sees the drafted email (outside messages are mocked), and Gayathri
// passes it to Poonam.
demo(async (p) => {
  await as(p, "aman", "/goals?tab=weekly");
  await check(p, "PMG nudges about a goal that's behind", "Is something in the way?");
  await p.getByRole("link", { name: "Raise a blocker" }).first().click();
  await p.fill("input[name=title]", "Can't load-test memory lookups without staging access");
  await p.fill("input[aria-label='Search people and teams']", "kanav");
  await p.getByRole("button", { name: /Kanav/ }).first().click();
  await p.fill("input[aria-label='Search people and teams']", "customer");
  await p.getByRole("button", { name: /Customer Success team/ }).click();
  await p.fill("input[name=needed]", "Read access to the staging database");
  await check(p, "email drafted from the blocker", "Email PMG drafted for Kanav");
  await p.getByRole("button", { name: "Raise and send" }).click();
  await p.waitForURL(/raised=2/);
  await check(p, "blocker sent to a person and a team head", "for the Customer Success team, as its head");
  await check(p, "outside messages mocked", "Email to Kanav Anand");
  await as(p, "gayathri", "/blockers?tab=waiting");
  const row = p.locator("li", { hasText: "Can't load-test memory lookups" }).first();
  await row.locator("select[name=to]").selectOption("poonam");
  await row.getByRole("button", { name: "Pass it on" }).click();
  await p.waitForLoadState("networkidle");
  await as(p, "aman", "/blockers");
  await check(p, "team head passed it on", "passed on by Gayathri");
});

main().catch((e) => { console.error(e); process.exit(1); });
