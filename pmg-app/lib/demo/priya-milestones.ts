// Demo data for the quarter milestones view: Priya's Q4 2026, as her manager (Mohammed) set it. Each milestone has
// its tasks decided up front, with start and end dates. Lives in code for now; the page keeps edits in memory only.

export type MsStatus = "yet_to_start" | "in_progress" | "pending" | "done";
export type DemoTask = { id: string; title: string; start: string; end: string; status: MsStatus; note?: string };
export type DemoMilestone = {
  id: string; code: string; title: string; why: string; start: string; end: string; setBy: string; tasks: DemoTask[];
};
export type DemoBlocker = {
  id: string; milestoneId: string; taskIds: string[]; title: string; owner: string; needBy: string; details: string;
  raisedOn: string; resolved: boolean;
};
export type DemoQuarter = { key: string; label: string; start: string; end: string; milestones: DemoMilestone[] };

export const HELPERS = [
  { id: "mohammed", name: "Mohammed Bhoraniya", title: "Lead Frontend · your manager" },
  { id: "salman", name: "Mahammad Salman Hawaldar", title: "Sr. UI/UX Designer" },
  { id: "kanav", name: "Kanav Anand", title: "Lead Backend" },
  { id: "venkatesh", name: "Venkatesh TR", title: "Sr. Software Engineer" },
  { id: "rupam", name: "Rupam Mishra", title: "Sr. QA Engineer" },
];

export const QUARTERS: DemoQuarter[] = [
  { key: "2026-07-01", label: "Q3 2026", start: "2026-07-01", end: "2026-09-30", milestones: [] },
  {
    key: "2026-10-01", label: "Q4 2026", start: "2026-10-01", end: "2026-12-31",
    milestones: [
      {
        id: "m1", code: "M1", title: "Design System v2 components",
        why: "Ship the shared React component library so product squads stop re-building inputs and dialogs.",
        start: "2026-10-01", end: "2026-10-24", setBy: "Mohammed Bhoraniya",
        tasks: [
          { id: "m1t1", title: "Audit existing components and design tokens", start: "2026-10-01", end: "2026-10-06", status: "done" },
          { id: "m1t2", title: "Build Button, Input and Select in Storybook", start: "2026-10-07", end: "2026-10-14", status: "done" },
          { id: "m1t3", title: "Modal and Toast with focus trap", start: "2026-10-13", end: "2026-10-20", status: "done" },
          { id: "m1t4", title: "Dark-mode tokens across all components", start: "2026-10-17", end: "2026-10-24", status: "pending", note: "Waiting on the final dark palette from Design." },
        ],
      },
      {
        id: "m2", code: "M2", title: "Checkout flow revamp",
        why: "Rebuild checkout as a responsive, accessible React flow to cut drop-off on mobile.",
        start: "2026-10-20", end: "2026-11-27", setBy: "Mohammed Bhoraniya",
        tasks: [
          { id: "m2t1", title: "Responsive cart page", start: "2026-10-20", end: "2026-10-28", status: "done" },
          { id: "m2t2", title: "Address form with inline validation", start: "2026-10-26", end: "2026-11-04", status: "in_progress" },
          { id: "m2t3", title: "Coupon and price summary panel", start: "2026-10-28", end: "2026-11-06", status: "in_progress" },
          { id: "m2t4", title: "Payment step UI (Razorpay widget)", start: "2026-11-09", end: "2026-11-18", status: "yet_to_start" },
          { id: "m2t5", title: "Order confirmation screen", start: "2026-11-16", end: "2026-11-21", status: "yet_to_start" },
          { id: "m2t6", title: "WCAG AA accessibility pass", start: "2026-11-20", end: "2026-11-27", status: "yet_to_start" },
        ],
      },
      {
        id: "m3", code: "M3", title: "Core Web Vitals to green",
        why: "Get LCP, CLS and INP into the green on the five busiest pages before the January sale.",
        start: "2026-12-01", end: "2026-12-23", setBy: "Mohammed Bhoraniya",
        tasks: [
          { id: "m3t1", title: "Lighthouse baseline on the five key pages", start: "2026-12-01", end: "2026-12-03", status: "yet_to_start" },
          { id: "m3t2", title: "Lazy-load images and code-split routes", start: "2026-12-04", end: "2026-12-11", status: "yet_to_start" },
          { id: "m3t3", title: "Bring LCP under 2.5s on the home page", start: "2026-12-10", end: "2026-12-18", status: "yet_to_start" },
          { id: "m3t4", title: "Performance budget check in CI", start: "2026-12-16", end: "2026-12-23", status: "yet_to_start" },
        ],
      },
    ],
  },
  { key: "2027-01-01", label: "Q1 2027", start: "2027-01-01", end: "2027-03-31", milestones: [] },
];

export const SEED_BLOCKERS: DemoBlocker[] = [
  {
    id: "b1", milestoneId: "m1", taskIds: ["m1t4"], title: "Final dark-mode palette not shared yet", owner: "salman",
    needBy: "2026-10-30", details: "Tokens are wired up but the colours are placeholders until the palette is signed off.",
    raisedOn: "2026-10-23", resolved: false,
  },
];
