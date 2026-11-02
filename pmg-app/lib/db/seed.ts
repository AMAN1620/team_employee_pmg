import type { DatabaseSync } from "node:sqlite";
import { seedPhase3 } from "./phase3";
import { seedPersonalGoals, seedPlanned } from "./planned";
import { DEMO_ACCOUNTS, hashPassword } from "@/lib/auth";
import { SEEDED_JIRA } from "@/lib/connectors/seeded";
import { addDays } from "@/lib/time";

const all = (db: DatabaseSync, sql: string) => (db.prepare(sql).all() as { id: number }[]).map((r) => r.id);

// Demo company from PMG_Stitch_Prompts.md ("Demo data used across screens"), with Engineering and Product
// from Jira epic SP0-112 (see phase3.ts). Demo date: Thu 29 Oct 2026 (the day the Jira data was pulled).

export function seed(db: DatabaseSync): void {
  const ins = (sql: string, ...p: (string | number | null)[]) => Number(db.prepare(sql).run(...p).lastInsertRowid);

  db.exec("BEGIN");
  try {
    // Teams: headcounts add up to 312. *_done_base are review counts for people who aren't modelled individually.
    const teams: [string, string, number, number, number][] = [
      ["product", "Product", 24, 12, 2], ["engineering", "Engineering", 104, 31, 2], ["cs", "Customer Success", 60, 27, 4],
      ["sales", "Sales & Marketing", 76, 21, 2], ["finance", "Finance & Ops", 34, 17, 3], ["people", "People", 14, 13, 4],
    ];
    for (const t of teams) ins("INSERT INTO teams (id,name,headcount,self_done_base,mgr_done_base) VALUES (?,?,?,?,?)", ...t);

    // The org chart, top down: [id, name, designation, team, manager]. Roles are derived below:
    // HR is HR, anyone with direct reports is a manager, everyone else an employee.
    const people: [string, string, string, string, string | null][] = [
      ["neha", "Neha Bagaria", "Founder & CEO", "people", null],
      ["priyadarshini", "Priyadarshini S", "VP - HR", "people", "neha"],
      ["muru", "Muru Arjunan", "Chief Technology Officer", "product", "neha"],
      ["anand", "Anand Babu", "AVP - Tech", "engineering", "muru"],
      ["shivakumar", "Shivakumar", "Automation Engineer", "engineering", "anand"],
      ["tharun", "Tharun Sai Reddy", "Software Engineer", "engineering", "anand"],
      ["suchitra", "Suchitra Jampal", "VP - Engineering", "engineering", "muru"],
      ["mohammed", "Mohammed Bhoraniya", "Lead Frontend", "engineering", "suchitra"],
      ["priya", "Priya Kumari", "Associate Software Engineer", "engineering", "mohammed"],
      ["rupam", "Rupam Mishra", "Sr. QA Engineer", "engineering", "suchitra"],
      ["subham", "Subham Das", "Senior QA Engineer", "engineering", "suchitra"],
      ["kanav", "Kanav Anand", "Lead Backend", "engineering", "suchitra"],
      ["athiqur", "Athiqur Rehman", "Software Engineer", "engineering", "kanav"],
      ["venkatesh", "Venkatesh TR", "Sr. Software Engineer", "engineering", "kanav"],
      ["aman", "Aman Kumar", "Associate Developer 2", "engineering", "venkatesh"],
      ["salman", "Mahammad Salman Hawaldar", "Sr. UI/UX Designer", "product", "muru"],
      ["anshika", "Anshika Goswami", "Product Manager", "product", "muru"],
      ["utkarsh", "Utkarsh Verma", "Sr. Product Manager", "product", "muru"],
      ["kumari", "Kumari Akriti", "Associate Product Manager", "product", "utkarsh"],
      ["bharathi", "Bharathi B S", "AVP - Accounts & Finance", "finance", "neha"],
      ["deepashree", "Deepashree A N", "Manager - Accounts", "finance", "bharathi"],
      ["prerna", "Prerna Makhija", "Manager - Finance", "finance", "bharathi"],
      ["sheeba", "Sheeba Royce", "Sr. Manager - Creative", "sales", "neha"],
      ["gayathri", "Gayathri B", "VP - Customer Success", "cs", "neha"],
      ["marissa", "Marissa Pinto", "Manager - Community", "cs", "gayathri"],
      ["anou", "Anou Daniel", "Manager - Clubs", "cs", "marissa"],
      ["rakshitha", "Rakshitha S M", "Coordinator - Speakers", "cs", "marissa"],
      ["poonam", "Poonam Ramesh", "AVP - Customer Success", "cs", "gayathri"],
      ["divya", "Divya Narayan", "Asst. Manager - Customer Success", "cs", "poonam"],
      ["pankaja", "Pankaja BS", "Assistant Manager - Customer Success", "cs", "poonam"],
      ["firdouse", "Firdouse", "Sr. Manager - Recruitment", "cs", "gayathri"],
      ["ophelia", "Ophelia Raphel", "Sr. Executive - Customer Success", "cs", "firdouse"],
      ["sheetal", "Sheetal N", "Regional Account Manager", "sales", "gayathri"],
      ["nandhan", "Nandhan K", "Lead Generation Executive", "sales", "sheetal"],
      ["harshitha", "Harshitha C", "B2B Marketing Specialist", "sales", "sheetal"],
      ["nida", "Nida Shaikh", "National Account Manager", "sales", "gayathri"],
      ["sahil", "Sahil Dhawan", "Regional Account Manager", "sales", "gayathri"],
      ["kanika", "Kanika Hirani", "Sr. Manager - Product Marketing", "sales", "neha"],
      ["nafeesath", "Nafeesath S", "Asst. Manager - Marketing", "sales", "kanika"],
      ["ram", "Ram Rathi", "Head of Digital Marketing", "sales", "neha"],
      ["ayesha", "Ayesha Ejas", "Asst. Manager - Digital Marketing", "sales", "ram"],
      ["nikitha", "Nikitha C", "Strategic Account Manager", "sales", "neha"],
    ];
    const managers = new Set(people.map((p) => p[4]).filter(Boolean));
    const managerOf = new Map(people.map((p) => [p[0], p[4]]));
    // Insert everyone first, then reporting lines, so a manager can be listed after their report.
    for (const [id, name, title, team] of people) {
      const role = id === "priyadarshini" ? "hr" : managers.has(id) ? "manager" : "employee";
      ins("INSERT INTO people (id,name,title,team_id,role,email) VALUES (?,?,?,?,?,?)", id, name, title, team, role, `${id}@acmelabs.in`);
    }
    for (const [id, , , , mgr] of people) if (mgr) ins("UPDATE people SET manager_id = ? WHERE id = ?", mgr, id);
    db.prepare("UPDATE people SET chat_connected = 0 WHERE id = 'nida'").run();

    const goal = (o: {
      level: string; title: string; owner: string; team: string; parent?: number | null; measure?: string;
      baseline?: number; target?: number; current?: number; unit?: string; mode: string; done?: number; total?: number;
      manual?: number; due: string; rubric?: string; deps?: string; status?: string; contribution?: string;
    }) => ins(
      `INSERT INTO goals (level,title,owner_id,team_id,parent_id,measure,baseline,target,current,unit,progress_mode,count_done,count_total,
        manual_progress,due_date,rubric,dependencies,status,approved_by,approved_at,contribution,created_at,submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      o.level, o.title, o.owner, o.team, o.parent ?? null, o.measure ?? null, o.baseline ?? null, o.target ?? null, o.current ?? null,
      o.unit ?? null, o.mode, o.done ?? null, o.total ?? null, o.manual ?? null, o.due, o.rubric ?? "{}", o.deps ?? null,
      o.status ?? "approved", o.status === "pending" ? null : managerOf.get(o.owner) ?? null, o.status === "pending" ? null : "2026-10-02",
      o.contribution ?? null, "2026-10-01T10:00", o.status === "pending" ? "2026-10-28T11:20" : "2026-10-01T10:00",
    );

    // Company goals
    const c1 = goal({ level: "company", title: "Grow ARR to ₹40 Cr by March 2027", owner: "neha", team: "people", mode: "manual", manual: 58, due: "2027-03-31" });
    const c2 = goal({ level: "company", title: "Keep customer satisfaction above 4.5", owner: "neha", team: "people", mode: "manual", manual: 71, due: "2027-03-31" });
    const c3 = goal({ level: "company", title: "Make Acme a great place to work: engagement score 4.2+", owner: "neha", team: "people", mode: "manual", manual: 49, due: "2027-03-31" });

    // Team goals. Engineering's is the Phase 3 epic, added by seedPhase3 below.
    const t1 = goal({ level: "team", title: "Cut new-customer time-to-value from 14 to 5 days", owner: "muru", team: "product", parent: c1, mode: "manual", manual: 52, due: "2026-12-31" });
    goal({ level: "team", title: "Close ₹18 Cr in new business", owner: "gayathri", team: "sales", parent: c1, mode: "manual", manual: 31, due: "2026-12-31" });
    goal({ level: "team", title: "Raise net revenue retention to 112%", owner: "gayathri", team: "cs", parent: c1, mode: "manual", manual: 55, due: "2026-12-31" });
    goal({ level: "team", title: "Keep support CSAT at 4.6 or higher", owner: "poonam", team: "cs", parent: c2, mode: "manual", manual: 62, due: "2026-12-31" });
    goal({ level: "team", title: "Launch quarterly engagement pulse with 80% response", owner: "priyadarshini", team: "people", parent: c3, mode: "manual", manual: 45, due: "2026-12-31" });

    // Engineering and Product: goals, milestones, blockers and wins come from Jira epic SP0-112 (Simkey Phase 3).
    // People connected to Jira get weekly, monthly and quarterly goals planned from their tickets instead.
    seedPhase3(db, new Set(Object.keys(SEEDED_JIRA)));
    seedPlanned(db);
    seedPersonalGoals(db);
    // Sign-in accounts for the people the prototype is built around (dummy passwords; see lib/auth.ts).
    for (const a of DEMO_ACCOUNTS) ins("INSERT INTO accounts (person_id,email,password_hash) VALUES (?,?,?)", a.personId, a.email, hashPassword(a.password));

    // The rest of the org: one or two goals each, so progress rolls up through every manager.
    const tFin = goal({ level: "team", title: "Close H1 books within 5 working days", owner: "bharathi", team: "finance", parent: c1, mode: "manual", manual: 60, due: "2026-12-31" });
    const tMkt = goal({ level: "team", title: "Generate 1,200 qualified leads", owner: "kanika", team: "sales", parent: c1, mode: "manual", manual: 47, due: "2026-12-31" });
    const tSales = all(db, "SELECT id FROM goals WHERE owner_id = 'gayathri' AND title LIKE 'Close%'")[0];
    const tCs = all(db, "SELECT id FROM goals WHERE owner_id = 'gayathri' AND title LIKE 'Raise%'")[0];
    const parentFor: Record<string, number> = { product: t1, finance: tFin, cs: tCs, sales: tSales, marketing: tMkt };
    // [owner, title, parent, progress]: progress is "done/total" (count), "base>target@current" (metric) or a % (manual).
    // Tharun and Muru have no Phase 3 issues, so they keep these.
    const EXTRA: [string, string, string, string][] = [
      ["tharun", "Fix 20 onboarding bugs from the backlog", "product", "12/20"],
      ["bharathi", "Automate monthly revenue reconciliation", "finance", "55"],
      ["deepashree", "Clear 95% of vendor payments on time", "finance", "82>95@90"],
      ["prerna", "Publish the Q3 budget review", "finance", "65"],
      ["marissa", "Launch 6 new community clubs", "cs", "4/6"],
      ["anou", "Run 10 club events this quarter", "cs", "6/10"],
      ["rakshitha", "Book 12 speakers for club events", "cs", "7/12"],
      ["poonam", "Cut churn in mid-size accounts to 3%", "cs", "5>3@4"],
      ["divya", "Resolve 95% of tickets within SLA", "cs", "88>95@91"],
      ["pankaja", "Onboard 40 new enterprise accounts", "cs", "22/40"],
      ["firdouse", "Close 15 recruitment mandates", "cs", "8/15"],
      ["ophelia", "Raise support CSAT to 4.6", "cs", "4.2>4.6@4.4"],
      ["gayathri", "Hire 2 regional account managers", "cs", "1/2"],
      ["sheetal", "Close ₹2 Cr in the South region", "sales", "48"],
      ["nandhan", "Generate 300 qualified leads", "marketing", "170/300"],
      ["harshitha", "Launch 2 B2B campaigns", "marketing", "1/2"],
      ["nida", "Close ₹5 Cr in national accounts", "sales", "52"],
      ["sahil", "Close ₹2 Cr in the North region", "sales", "30"],
      ["nikitha", "Renew 10 strategic accounts", "sales", "6/10"],
      ["kanika", "Grow inbound leads by 40%", "marketing", "0>40@22"],
      ["nafeesath", "Publish 24 marketing content pieces", "marketing", "15/24"],
      ["ram", "Cut cost per lead to ₹800", "marketing", "1200>800@1000"],
      ["ayesha", "Grow organic traffic by 30%", "marketing", "0>30@14"],
      ["sheeba", "Deliver 40 creative assets for Q3 campaigns", "marketing", "26/40"],
    ];
    for (const [owner, title, area, prog] of EXTRA) {
      const team = people.find((p) => p[0] === owner)![3];
      const base = { level: "individual", title, owner, team, parent: parentFor[area], due: "2026-12-31" };
      const count = prog.match(/^(\d+)\/(\d+)$/), metric = prog.match(/^([\d.]+)>([\d.]+)@([\d.]+)$/);
      if (count) goal({ ...base, mode: "count", done: Number(count[1]), total: Number(count[2]) });
      else if (metric) goal({ ...base, mode: "metric", baseline: Number(metric[1]), target: Number(metric[2]), current: Number(metric[3]) });
      else goal({ ...base, mode: "manual", manual: Number(prog) });
    }
    goal({ level: "individual", title: "Lead the Q4 planning offsite", owner: "muru", team: "product", parent: t1, mode: "manual", manual: 40, due: "2026-12-12" });

    // Past check-ins (confirmed). Dev missed this week; Anshika's current check-in comes through the demo.
    const checkin = (person: string, week: string, mood: number, moved: string, stuck: string, next: string, at: string) =>
      ins("INSERT INTO checkins (person_id,week_of,moved,stuck,next,mood,source,status,submitted_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        person, week, moved, stuck, next, mood, "chat", "confirmed", at, at);
    const teamMoods: Record<string, number[]> = { anshika: [3, 4, 3, 4, 4, 5], salman: [4, 4, 5, 4, 4, 5, 4], utkarsh: [3, 3, 4, 3, 4, 3, 4], suchitra: [4, 3, 3, 2, 3, 3, 3], anand: [4, 4, 4, 5, 4, 4] };
    const weeks = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
    for (const [person, moods] of Object.entries(teamMoods)) {
      moods.forEach((mood, i) => checkin(person, weeks[i], mood, "Weekly progress update.", "", "", `${addDays(weeks[i], 3)}T11:00`));
    }
    // Everyone else: a steady weekly rhythm with varied moods; every fifth person hasn't checked in this week yet.
    people.map((p) => p[0]).filter((id) => id !== "neha" && id !== "priyadarshini" && !(id in teamMoods)).forEach((id, n) => {
      const upTo = n % 5 === 4 ? weeks.length - 1 : weeks.length;
      for (let i = 0; i < upTo; i++) {
        const mood = 3 + ((n + i) % 3 === 0 ? 1 : 0) + ((n * 7 + i) % 5 === 0 ? -1 : 0) + (i === upTo - 1 && n % 4 === 0 ? 1 : 0);
        checkin(id, weeks[i], Math.min(5, Math.max(1, mood)), "Weekly progress update.", "", "", `${addDays(weeks[i], 3)}T11:30`);
      }
    });

    // 1:1s
    const one = ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "anshika", "muru", "2026-10-29T16:00", "");
    for (const d of ["2026-10-22T16:00", "2026-10-15T16:00", "2026-10-08T16:00"])
      ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "anshika", "muru", d, "");
    ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "salman", "muru", "2026-10-30T11:00", "");
    ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "utkarsh", "muru", "2026-10-30T15:00", "");
    ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "suchitra", "muru", "2026-11-02T12:00", "");
    ins("INSERT INTO one_on_ones (employee_id,manager_id,scheduled_at,notes) VALUES (?,?,?,?)", "anand", "muru", "2026-11-03T14:00", "");
    ins("INSERT INTO agenda_topics (one_on_one_id,author_id,text,at) VALUES (?,?,?,?)", one, "anshika", "Path to Senior Product Manager", "2026-10-27T09:00");
    ins("INSERT INTO agenda_topics (one_on_one_id,author_id,text,at) VALUES (?,?,?,?)", one, "muru", "Input for Q4 planning", "2026-10-28T09:00");
    ins("INSERT INTO action_items (employee_id,manager_id,one_on_one_id,owner_id,text,due,carried_from,created_at) VALUES (?,?,?,?,?,?,?,?)",
      "anshika", "muru", one, "muru", "Share promotion criteria for Senior Product Manager", "2026-10-26", "2026-10-15", "2026-10-22T16:30");

    // Review cycle
    const cycle = ins("INSERT INTO review_cycles (name,self_due,manager_due,status) VALUES (?,?,?,?)", "Mid-year review FY 2026–27", "2026-11-06", "2026-12-11", "active");
    const levels: [number, string, string][] = [
      [1, "Needs improvement", "Missed most of the goal's measures without a clear reason."],
      [2, "Partially meets", "Made progress but missed the target."],
      [3, "Meets", "Hit the target agreed in the goal card."],
      [4, "Exceeds", "Beat the target, or hit it early with strong quality."],
      [5, "Outstanding", "Exceptional results that changed outcomes for the team or company."],
    ];
    for (const [level, label, desc] of levels) ins("INSERT INTO rating_levels (cycle_id,level,label,description) VALUES (?,?,?,?)", cycle, level, label, desc);
    for (const p of ["salman", "utkarsh", "anand"])
      ins("INSERT INTO reviews (cycle_id,person_id,reviewer_id,kind,status,payload,submitted_at) VALUES (?,?,?,?,?,?,?)", cycle, p, p, "self", "submitted", "{}", "2026-10-27T18:00");

    // Chat: what's already in each person's DM with the PMG bot. Phase 3 blocker requests come from seedPhase3.
    const chat = (to: string, from: string, kind: string, body: string, at: string, data: object = {}, handled: string | null = null) =>
      ins("INSERT INTO chat_messages (to_id,from_id,kind,body,data,at,handled) VALUES (?,?,?,?,?,?,?)", to, from, kind, body, JSON.stringify(data), at, handled);
    chat("anshika", "pmg", "checkin_prompt", "Hi Anshika, time for your weekly check-in. What moved? What's stuck? What's next?", "2026-10-29T10:00");
    chat("muru", "pmg", "reminder", "Your 1:1 with Anshika is at 4:00 PM. The agenda is ready.", "2026-10-29T09:00", { href: "/one-on-ones" });

    const settings: [string, string][] = [
      ["chat.provider", "simulator"], ["chat.workspace", "acme-labs"], ["chat.checkin_schedule", "Thursdays, 10:00 AM"],
      ["chat.feature.checkin", "1"], ["chat.feature.blockers", "1"], ["chat.feature.kudos", "1"], ["chat.feature.feedback", "1"],
      ["chat.feature.reminders", "1"], ["chat.feature.approvals", "1"], ["chat.feature.reviews", "1"],
      ["org.metrics", JSON.stringify({ checkinParticipation: 81, checkinDelta: 6, blockerDays: 3.2, blockerDelta: -0.8, health: [64, 26, 10], mood: 3.9, hoursSaved: 1240, milestonesOnTime: 71, recognized: 74 })],
    ];
    for (const [k, v] of settings) ins("INSERT INTO settings (key,value) VALUES (?,?)", k, v);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
