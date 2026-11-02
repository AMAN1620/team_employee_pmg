import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Icon({ name, className, fill }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span aria-hidden className={cx("material-symbols-outlined", fill && "icon-fill", className ?? "text-[20px]")}>
      {name}
    </span>
  );
}

export function Card({ children, className, accent }: { children: ReactNode; className?: string; accent?: "violet" | "teal" }) {
  return (
    <section
      className={cx(
        "card",
        accent === "violet" && "border-t-[3px] border-t-violet",
        accent === "teal" && "border-t-[3px] border-t-teal",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, icon, iconTone = "teal", right, subtitle }: {
  title: ReactNode; icon?: string; iconTone?: "teal" | "violet" | "rose" | "amber" | "slate"; right?: ReactNode; subtitle?: ReactNode;
}) {
  const tones = {
    teal: "bg-teal-tint text-teal", violet: "bg-violet-tint text-violet", rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700", slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", tones[iconTone])}>
            <Icon name={icon} />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="text-body-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

type PillTone = "green" | "amber" | "red" | "slate" | "teal" | "rose" | "violet" | "blue";
const PILL_TONES: Record<PillTone, string> = {
  green: "text-[#15803D] bg-[#DCFCE7]", amber: "text-[#B45309] bg-[#FEF3C7]", red: "text-[#B91C1C] bg-[#FEE2E2]",
  slate: "text-[#475569] bg-[#F1F5F9]", teal: "text-[#0F766E] bg-[#CCFBF1]", rose: "text-[#BE123C] bg-[#FFE4E6]",
  violet: "text-[#7C3AED] bg-[#EDE9FE]", blue: "text-blue-700 bg-blue-50",
};

export function Pill({ tone = "slate", icon, children, className }: { tone?: PillTone; icon?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-pill-tag whitespace-nowrap", PILL_TONES[tone], className)}>
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  );
}

export type GoalHealthLabel = "On track" | "At risk" | "Off track";
export function HealthPill({ health }: { health: GoalHealthLabel | string }) {
  if (health === "On track") return <Pill tone="green" icon="check_circle">On track</Pill>;
  if (health === "At risk") return <Pill tone="amber" icon="warning">At risk</Pill>;
  if (health === "Off track") return <Pill tone="red" icon="error">Off track</Pill>;
  return <Pill tone="slate">{health}</Pill>;
}

export function BlockerPill({ status }: { status: string }) {
  const map: Record<string, [PillTone, string, string]> = {
    waiting: ["slate", "hourglass_empty", "Waiting"],
    accepted: ["teal", "thumb_up", "Accepted"],
    needs_info: ["amber", "help", "Needs info"],
    overdue: ["rose", "schedule", "Overdue"],
    resolved: ["green", "check_circle", "Resolved"],
    redirected: ["slate", "alt_route", "Redirected"],
  };
  const [tone, icon, label] = map[status] ?? ["slate", "help", status];
  return <Pill tone={tone} icon={icon}>{label}</Pill>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: PillTone = role === "manager" ? "violet" : role === "hr" ? "blue" : "teal";
  const label = role === "hr" ? "HR" : role === "manager" ? "Manager" : "Employee";
  return <Pill tone={tone} className="h-5 px-2">{label}</Pill>;
}

const AVATAR_COLORS = ["bg-teal-600", "bg-violet-600", "bg-sky-600", "bg-amber-600", "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-fuchsia-600"];
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      title={name}
      className={cx("inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ring-2 ring-white", color, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials}
    </span>
  );
}

export function ProgressBar({ value, tone = "teal", className }: { value: number; tone?: "teal" | "amber" | "red" | "violet"; className?: string }) {
  const tones = { teal: "bg-teal", amber: "bg-[#B45309]", red: "bg-[#B91C1C]", violet: "bg-violet" };
  return (
    <div className={cx("h-2 rounded-full bg-surface-container overflow-hidden", className)}>
      <div className={cx("h-full rounded-full", tones[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function healthTone(health: string): "teal" | "amber" | "red" {
  return health === "At risk" ? "amber" : health === "Off track" ? "red" : "teal";
}

export function AiBox({ title = "Drafted by AI · Review before saving", children, tone = "teal", className }: {
  title?: string; children: ReactNode; tone?: "teal" | "amber" | "violet"; className?: string;
}) {
  const tones = { teal: "bg-teal-tint/40 border-teal/20", amber: "bg-amber-50 border-amber-200", violet: "bg-violet-tint/60 border-violet/20" };
  return (
    <div className={cx("rounded-xl border p-4", tones[tone], className)}>
      <div className="flex items-center gap-1.5 text-label-sm text-teal mb-2">
        <Icon name="auto_awesome" className="text-[16px]" />
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

const EVIDENCE_ICONS: Record<string, string> = {
  win: "emoji_events", checkin: "fact_check", blocker: "report", feedback: "rate_review", kudos: "favorite",
  helped: "volunteer_activism", unplanned: "bolt", link: "link", jira: "confirmation_number",
};
export function EvidenceChip({ kind, label, href }: { kind: string; label: string; href?: string }) {
  const body = (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-slate-100 text-slate-700 text-label-sm border border-line whitespace-nowrap shrink-0">
      <Icon name={EVIDENCE_ICONS[kind] ?? "link"} className="text-[14px]" />
      {label}
    </span>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Stat({ label, value, sub, tone = "ink", icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ink" | "violet" | "teal" | "rose" | "amber"; icon?: string }) {
  const tones = { ink: "text-ink", violet: "text-violet", teal: "text-teal", rose: "text-rose-700", amber: "text-amber-700" };
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-label-sm text-muted uppercase tracking-wide">
        {icon && <Icon name={icon} className="text-[16px]" />}
        {label}
      </div>
      <div className={cx("text-headline-md mt-1", tones[tone])}>{value}</div>
      {sub && <div className="text-body-sm text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="flex gap-1 border-b border-line mb-5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cx(
            "px-4 py-2.5 text-label-md -mb-px border-b-2 transition-colors",
            t.key === active ? "border-teal text-teal font-semibold" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, right, chip }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; chip?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title">{title}</h1>
          {chip}
        </div>
        {subtitle && <p className="text-body-md text-muted mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

export function Empty({ icon = "inbox", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-6 text-muted">
      <Icon name={icon} className="text-[32px] text-slate-300" />
      <p className="text-title-md text-ink mt-2">{title}</p>
      {children && <div className="text-body-md mt-1">{children}</div>}
    </div>
  );
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", opts);
}

/** "16:00" or "2026-11-19T16:00" → "4:00 PM" */
export function fmtTime(isoOrTime: string) {
  const t = isoOrTime.length > 5 ? isoOrTime.slice(11, 16) : isoOrTime;
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
