// The quarter and month filter at the top of a goals board. Links only: the chosen period lives in the URL
// (?q=quarter start&m=month start, or ?week= alone, which opens that week's month).
import Link from "next/link";
import { Icon, cx, fmtDate } from "@/components/ui";
import { monthOfWeek, monthsOfQuarter, periodOf, quarterOfWeek } from "@/lib/planner";
import { today, weekStart } from "@/lib/time";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export type PeriodChoice = ReturnType<typeof periodFilter>;

/** Works out the quarter and month to show from the URL, offering the quarters the goals fall in plus this one. */
export function periodFilter({ goals, week, quarter, month, back }: {
  goals: { horizon: string | null; start_date: string }[]; week?: string; quarter?: string; month?: string; back: string;
}) {
  const cw = weekStart(today());
  const cq = quarterOfWeek(cw).start, cm = monthOfWeek(cw).start;
  const quarterOf = (g: { horizon: string | null; start_date: string }) => (g.horizon === "week" ? quarterOfWeek(g.start_date).start : periodOf("quarter", g.start_date).start);
  const quarters = [...new Set([...goals.filter((g) => g.horizon && g.horizon !== "feature").map(quarterOf), cq])].sort();
  const wanted = isDate(month) ? month! : isDate(week) ? monthOfWeek(weekStart(week!)).start : undefined;
  const qStart = quarter && quarters.includes(quarter) ? quarter : quarters.find((q) => wanted && monthsOfQuarter(q).includes(wanted)) ?? cq;
  const months = monthsOfQuarter(qStart);
  const mStart = wanted && months.includes(wanted) ? wanted : months.includes(cm) ? cm : months[0];
  const mPeriod = periodOf("month", mStart);
  const sep = back.includes("?") ? "&" : "?";
  const href = (p: { q?: string; m?: string; week?: string }) =>
    `${back}${sep}${new URLSearchParams(Object.entries({ q: qStart, m: mStart, ...p }).filter(([, v]) => v) as [string, string][])}`;
  return { cw, cq, cm, quarters, qStart, months, mStart, mPeriod, monthName: mPeriod.label.split(" ")[0], href, back, week: isDate(week) ? weekStart(week!) : undefined };
}

export function PeriodFilterBar({ f, right }: { f: PeriodChoice; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Segmented label="Quarter" value={f.qStart}
        options={f.quarters.map((q) => ({ key: q, label: periodOf("quarter", q).label.split(" (")[0], href: f.href({ q, m: "", week: "" }), current: q === f.cq }))} />
      <Segmented label="Month" value={f.mStart}
        options={f.months.map((m) => ({ key: m, label: fmtDate(m, { month: "long" }), href: f.href({ m, week: "" }), current: m === f.cm }))} />
      {f.mStart !== f.cm && <Link href={f.back} className="text-label-md text-teal hover:underline inline-flex items-center gap-1"><Icon name="today" className="text-[16px]" />Back to this month</Link>}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function Segmented({ label, options, value }: { label: string; options: { key: string; label: string; href: string; current: boolean }[]; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-label-sm text-muted uppercase tracking-wide">{label}</span>
      <div className="inline-flex rounded-lg border border-line bg-white p-1">
        {options.map((o) => (
          <Link key={o.key} href={o.href} scroll={false} className={cx("px-3 py-1.5 rounded-md text-label-md inline-flex items-center gap-1.5", o.key === value ? "bg-teal text-white" : "text-muted hover:text-ink")}>
            {o.label}{o.current && <span className={cx("w-1.5 h-1.5 rounded-full", o.key === value ? "bg-white" : "bg-teal")} title="Now" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
