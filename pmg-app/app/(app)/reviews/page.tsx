import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, Empty, PageHeader, Pill, fmtDate } from "@/components/ui";
import { activeCycle, directReports, getReview } from "@/lib/repo";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const me = await requirePerson();
  if (me.role !== "manager") redirect("/reviews/self");
  const { submitted } = await searchParams;
  const cycle = activeCycle();
  if (!cycle) return <Card><Empty title="No review cycle is running" /></Card>;
  const reports = directReports(me.id);
  return (
    <div>
      <PageHeader title={cycle.name} subtitle={`Self-reviews due ${fmtDate(cycle.self_due)} · manager reviews due ${fmtDate(cycle.manager_due)}`}
        right={<Link href="/reviews/self" className="btn-secondary">My self-appraisal</Link>} />
      {submitted && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-body-md text-green-800">Review submitted. HR can see it&apos;s complete.</div>}
      <Card><ul className="divide-y divide-line">
        {reports.map((p) => {
          const self = getReview(cycle.id, p.id, "self");
          const mgr = getReview(cycle.id, p.id, "manager");
          return (
            <li key={p.id} className="p-5 flex items-center gap-4">
              <Avatar name={p.name} size={40} />
              <div className="flex-1"><p className="text-title-md">{p.name}</p><p className="text-body-sm text-muted">{p.title}</p></div>
              <Pill tone={self?.status === "submitted" ? "green" : "slate"}>Self: {self?.status === "submitted" ? "submitted" : self ? "draft" : "not started"}</Pill>
              <Pill tone={mgr?.status === "submitted" ? "green" : mgr ? "teal" : "amber"}>Yours: {mgr?.status === "submitted" ? "submitted" : mgr ? "draft" : "to do"}</Pill>
              <Link href={`/reviews/manager/${p.id}`} className="btn-primary btn-sm">{mgr?.status === "submitted" ? "View" : "Review"}</Link>
            </li>
          );
        })}
      </ul></Card>
    </div>
  );
}
