// Saves every screen as a standalone HTML file (app CSS inlined, scripts removed, links between screens rewritten).
// Run against a running server:  npm run dev  then  npx tsx scripts/export-screens.ts [outDir]
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { SESSION_COOKIE, signSession } from "../lib/auth";

const BASE = process.env.PMG_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "../pmg-screens");

type Screen = { file: string; title: string; as: string | null; path: string };
type Group = { name: string; who: string; screens: Screen[] };

const GROUPS: Group[] = [
  { name: "Sign-in", who: "Signed out", screens: [
    { file: "sign-in", title: "Sign in", as: null, path: "/" },
  ] },
  { name: "Employee", who: "Aman Kumar", screens: [
    { file: "employee-home", title: "Home", as: "aman", path: "/home" },
    { file: "employee-goals", title: "Goals (Work)", as: "aman", path: "/goals" },
    { file: "employee-goals-personal", title: "Goals (Personal)", as: "aman", path: "/goals?tab=personal" },
    { file: "employee-goal-new", title: "Create a goal", as: "aman", path: "/goals/new" },
    { file: "employee-goal-detail", title: "Goal detail", as: "aman", path: "/goals/25" },
    { file: "employee-goals-milestones", title: "Milestones", as: "aman", path: "/goals/milestones" },
    { file: "employee-work", title: "My work", as: "aman", path: "/work" },
    { file: "employee-checkins", title: "Check-ins", as: "aman", path: "/checkins" },
    { file: "employee-checkin-new", title: "New check-in", as: "aman", path: "/checkins?new=1" },
    { file: "employee-blockers", title: "Blockers", as: "aman", path: "/blockers" },
    { file: "employee-blocker-raise", title: "Raise a blocker", as: "aman", path: "/blockers?drawer=1" },
    { file: "employee-wins", title: "Wins", as: "aman", path: "/wins" },
    { file: "employee-one-on-ones", title: "1:1s", as: "aman", path: "/one-on-ones" },
    { file: "employee-feedback", title: "Feedback", as: "aman", path: "/feedback" },
    { file: "employee-feedback-give", title: "Give feedback", as: "aman", path: "/feedback?give=venkatesh" },
    { file: "employee-self-review", title: "Self-appraisal", as: "aman", path: "/reviews/self" },
    { file: "employee-privacy", title: "Privacy settings", as: "aman", path: "/settings/privacy" },
    { file: "employee-chat", title: "Chat", as: "aman", path: "/chat" },
  ] },
  { name: "Manager", who: "Venkatesh TR (Muru Arjunan for the whole org)", screens: [
    { file: "manager-team", title: "Team", as: "venkatesh", path: "/team" },
    { file: "manager-team-org", title: "Team (whole org)", as: "muru", path: "/team?scope=org" },
    { file: "manager-team-member", title: "Team member", as: "venkatesh", path: "/team/aman" },
    { file: "manager-approvals", title: "Approvals", as: "venkatesh", path: "/approvals" },
    { file: "manager-approval-detail", title: "Goal approval", as: "venkatesh", path: "/approvals/88" },
    { file: "manager-blockers", title: "Blockers (waiting on me)", as: "venkatesh", path: "/blockers?tab=waiting" },
    { file: "manager-one-on-ones", title: "1:1 with Aman", as: "venkatesh", path: "/one-on-ones?with=aman" },
    { file: "manager-reviews", title: "Reviews", as: "venkatesh", path: "/reviews" },
    { file: "manager-review-person", title: "Manager review", as: "venkatesh", path: "/reviews/manager/aman" },
    { file: "manager-chat", title: "Chat", as: "venkatesh", path: "/chat" },
  ] },
  { name: "HR", who: "Priyadarshini S", screens: [
    { file: "hr-overview", title: "Overview", as: "priyadarshini", path: "/hr" },
    { file: "hr-company-goals", title: "Company goals", as: "priyadarshini", path: "/hr/goals" },
    { file: "hr-review-cycles", title: "Review cycles", as: "priyadarshini", path: "/hr/cycles" },
    { file: "hr-calibration", title: "Calibration", as: "priyadarshini", path: "/hr/calibration" },
    { file: "hr-people", title: "People", as: "priyadarshini", path: "/hr/people" },
    { file: "hr-integrations", title: "Integrations", as: "priyadarshini", path: "/hr/integrations" },
    { file: "hr-chat", title: "Chat", as: "priyadarshini", path: "/chat" },
  ] },
];

// A link goes to the screen (of the same role, or sign-in) with the same path whose query params it all carries,
// preferring the screen with the most params.
function linkTargets(as: string | null): { path: string; file: string }[] {
  const role = GROUPS.find((g) => g.screens.some((s) => s.as === as))!;
  return [{ path: "/", file: "sign-in.html" }, ...role.screens.map((s) => ({ path: s.path, file: `${s.file}.html` }))];
}

async function capture(page: Page, s: Screen): Promise<string> {
  await page.context().clearCookies();
  if (s.as) await page.context().addCookies([{ name: SESSION_COOKIE, value: signSession(s.as), url: BASE, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`${BASE}${s.path}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async ({ targets, title }) => {
    // Inline the app's own stylesheets; Google Fonts stay as links.
    for (const l of Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]"))) {
      if (new URL(l.href).origin !== location.origin) continue;
      const style = document.createElement("style");
      style.textContent = await (await fetch(l.href)).text();
      l.replaceWith(style);
    }
    document.querySelectorAll("script, noscript, link[rel=preload], link[rel=modulepreload], link[as=script], nextjs-portal, next-route-announcer").forEach((n) => n.remove());
    // Keep what's typed or ticked in the saved page.
    document.querySelectorAll<HTMLInputElement>("input").forEach((i) => {
      if (i.type === "checkbox" || i.type === "radio") i.toggleAttribute("checked", i.checked);
      else if (i.type !== "password") i.setAttribute("value", i.value);
    });
    document.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((t) => (t.textContent = t.value));
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const u = new URL(a.href);
      if (u.origin !== location.origin) return;
      let best: { file: string; score: number } | undefined;
      for (const t of targets) {
        const tu = new URL(t.path, location.origin);
        const params = [...tu.searchParams];
        if (tu.pathname !== u.pathname || !params.every(([k, v]) => u.searchParams.get(k) === v)) continue;
        if (!best || params.length > best.score) best = { file: t.file, score: params.length };
      }
      a.setAttribute("href", best?.file ?? "index.html");
    });
    document.querySelectorAll("form").forEach((f) => f.setAttribute("onsubmit", "return false"));
    document.title = `PMG · ${title}`;
    return `<!doctype html>\n${document.documentElement.outerHTML}`;
  }, { targets: linkTargets(s.as), title: s.title });
}

function indexPage(): string {
  const groups = GROUPS.map((g) => `
    <section><h2>${g.name} <span>${g.who}</span></h2><ul>${g.screens.map((s) => `
      <li><a href="${s.file}.html">${s.title}</a><code>${s.path}</code></li>`).join("")}
    </ul></section>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PMG screens</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 40px 16px; font-family: Inter, system-ui, sans-serif; background: #f7f8f8; color: #14211f; }
  main { max-width: 880px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; } p { color: #5b6b68; margin: 0 0 32px; }
  h2 { font-size: 15px; margin: 28px 0 10px; } h2 span { font-weight: 400; color: #5b6b68; margin-left: 8px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  li { background: #fff; border: 1px solid #e2e7e6; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
  a { color: #0f766e; font-weight: 600; text-decoration: none; } a:hover { text-decoration: underline; }
  code { font-size: 12px; color: #5b6b68; }
</style></head>
<body><main>
  <h1>PMG screens</h1>
  <p>Static HTML snapshots of every screen, captured from the running app on demo data. Buttons don't act; links move between screens. <a href="employee-all-screens.html">All employee screens in one page</a></p>
  ${groups}
</main></body></html>
`;
}

// One page holding several screens (they share one stylesheet), switched by the URL hash, with links rewritten
// to move between them and a small picker for screens the sidebar doesn't reach.
function combinedPage(title: string, screens: Screen[], html: Map<string, string>, home: string): string {
  const head = html.get(screens[0].file)!.match(/<head>([\s\S]*?)<\/head>/)![1].replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  const files = new Set(screens.map((s) => s.file));
  const sections = screens.map((s) => {
    const body = html.get(s.file)!.match(/<body[^>]*>([\s\S]*)<\/body>/)![1]
      .replace(/href="([\w-]+)\.html"/g, (_, f: string) => `href="#${files.has(f) ? f : home}"`);
    return `<section class="pmg-screen" data-screen="${s.file}" data-title="${s.title}" hidden>${body}</section>`;
  }).join("\n");
  const options = screens.map((s) => `<option value="${s.file}">${s.title}</option>`).join("");
  return `<!doctype html>
<html lang="en"><head>${head}
<style>
  .pmg-picker { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; align-items: center; gap: 4px; padding: 6px; background: #fff; border: 1px solid #e2e7e6; border-radius: 12px; box-shadow: 0 8px 24px rgba(20, 33, 31, .14); font: 500 13px Inter, system-ui, sans-serif; }
  .pmg-picker button { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: #0f766e; font-size: 18px; cursor: pointer; }
  .pmg-picker button:hover { background: #f0f7f6; }
  .pmg-picker select { height: 32px; border: 1px solid #e2e7e6; border-radius: 8px; padding: 0 8px; font: inherit; color: #14211f; background: #fff; }
  .pmg-picker span { color: #5b6b68; padding: 0 4px 0 8px; }
</style></head>
<body>
${sections}
<nav class="pmg-picker" aria-label="Screens">
  <span id="pmg-count"></span>
  <button type="button" id="pmg-prev" aria-label="Previous screen">‹</button>
  <select id="pmg-select" aria-label="Screen">${options}</select>
  <button type="button" id="pmg-next" aria-label="Next screen">›</button>
</nav>
<script>
  const screens = [...document.querySelectorAll(".pmg-screen")];
  const ids = screens.map((s) => s.dataset.screen);
  const select = document.getElementById("pmg-select");
  function show() {
    const id = ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : ${JSON.stringify(home)};
    screens.forEach((s) => (s.hidden = s.dataset.screen !== id));
    select.value = id;
    document.getElementById("pmg-count").textContent = (ids.indexOf(id) + 1) + " / " + ids.length;
    document.title = "PMG · " + screens[ids.indexOf(id)].dataset.title;
    window.scrollTo(0, 0);
  }
  const go = (step) => (location.hash = ids[(ids.indexOf(select.value) + step + ids.length) % ids.length]);
  select.addEventListener("change", () => (location.hash = select.value));
  document.getElementById("pmg-prev").addEventListener("click", () => go(-1));
  document.getElementById("pmg-next").addEventListener("click", () => go(1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  });
  window.addEventListener("hashchange", show);
  show();
</script>
</body></html>
`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const html = new Map<string, string>();
  try {
    for (const s of GROUPS.flatMap((g) => g.screens)) {
      html.set(s.file, await capture(page, s));
      fs.writeFileSync(path.join(OUT, `${s.file}.html`), html.get(s.file)!);
      console.log(`✓ ${s.file}.html  ${s.path}`);
    }
    fs.writeFileSync(path.join(OUT, "index.html"), indexPage());
    const employee = GROUPS.filter((g) => g.name === "Sign-in" || g.name === "Employee").flatMap((g) => g.screens);
    fs.writeFileSync(path.join(OUT, "employee-all-screens.html"), combinedPage("PMG · Employee screens", employee, html, "employee-home"));
    console.log("✓ employee-all-screens.html  (every employee screen in one page)");
    console.log(`\nSaved ${GROUPS.flatMap((g) => g.screens).length} screens and index.html to ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
