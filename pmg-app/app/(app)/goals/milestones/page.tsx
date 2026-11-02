// Demo: the quarter-milestones version of the goals page, on Priya's Q4 data (see lib/demo/priya-milestones.ts).
// Priya gets it as her Work goals at /goals; anyone else can open it here to look.
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { Icon } from "@/components/ui";
import { MilestoneBoard } from "@/components/plan/MilestoneBoard";
import { today } from "@/lib/time";

export default async function MilestonesDemoPage() {
  const me = await requirePerson();
  if (me.id === "priya") redirect("/goals");
  return (
    <div>
      <Link href="/goals" className="text-label-md text-muted hover:text-teal inline-flex items-center gap-1 mb-4"><Icon name="arrow_back" className="text-[16px]" />My goals</Link>
      <p className="mb-4 rounded-xl border border-violet/30 bg-violet-tint/40 p-3 text-body-sm text-violet">Showing Priya Kumari&apos;s demo milestones.</p>
      <MilestoneBoard today={today()} owner="Priya" />
    </div>
  );
}
