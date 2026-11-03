import Link from "next/link";
import { Sidebar, type NavItem } from "@/components/shell/Sidebar";
import { Avatar, Icon } from "@/components/ui";
import { requirePerson } from "@/lib/session";
import { all, get } from "@/lib/db";
import { pendingApprovals, type Person } from "@/lib/repo";

function navFor(person: Person): NavItem[] {
  const unread = get<{ n: number }>("SELECT COUNT(*) AS n FROM chat_messages WHERE to_id = ? AND handled IS NULL AND kind IN ('blocker_request','approval_request','checkin_prompt','feedback_request')", person.id)?.n ?? 0;
  if (person.role === "hr") {
    return [
      { href: "/hr", label: "Overview", icon: "dashboard" },
      { href: "/hr/goals", label: "Company goals", icon: "account_tree" },
      { href: "/hr/cycles", label: "Review cycles", icon: "event_repeat" },
      { href: "/hr/calibration", label: "Calibration", icon: "balance" },
      { href: "/hr/people", label: "People", icon: "group" },
      { href: "/hr/integrations", label: "Integrations", icon: "hub" },
      { href: "/chat", label: "Chat", icon: "chat", badge: unread },
    ];
  }
  if (person.role === "manager") {
    const approvals = pendingApprovals(person.id).length;
    const waitingOnMe = get<{ n: number }>("SELECT COUNT(*) AS n FROM blockers WHERE owner_id = ? AND status != 'resolved'", person.id)?.n ?? 0;
    return [
      { href: "/team", label: "Team", icon: "groups" },
      { href: "/approvals", label: "Approvals", icon: "approval", badge: approvals },
      { href: "/blockers", label: "Blockers", icon: "report", badge: waitingOnMe },
      { href: "/todos", label: "To-dos", icon: "checklist" },
      { href: "/one-on-ones", label: "1:1s", icon: "forum" },
      { href: "/reviews", label: "Reviews", icon: "workspace_premium" },
      { href: "/chat", label: "Chat", icon: "chat", badge: unread },
      { href: "/goals", label: "My goals", icon: "flag", divider: "My work" },
      { href: "/work", label: "My work", icon: "assignment" },
      { href: "/wins", label: "My wins", icon: "celebration" },
      { href: "/checkins", label: "My check-ins", icon: "fact_check" },
    ];
  }
  return [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/goals", label: "Goals", icon: "flag" },
    { href: "/work", label: "My work", icon: "assignment" },
    { href: "/checkins", label: "Check-ins", icon: "fact_check" },
    { href: "/blockers", label: "Blockers", icon: "report" },
    { href: "/todos", label: "To-dos", icon: "checklist" },
    { href: "/wins", label: "Wins", icon: "celebration" },
    { href: "/one-on-ones", label: "1:1s", icon: "forum" },
    { href: "/feedback", label: "Feedback", icon: "rate_review" },
    { href: "/reviews/self", label: "Reviews", icon: "workspace_premium" },
    { href: "/chat", label: "Chat", icon: "chat", badge: unread },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await requirePerson();
  const unread = all("SELECT id FROM chat_messages WHERE to_id = ? AND handled IS NULL AND from_id = 'pmg' AND kind != 'kudos_notice'", person.id).length;

  return (
    <div>
      <Sidebar
        nav={navFor(person)}
        person={{ id: person.id, name: person.name, title: person.title, role: person.role }}
      />
      <div className="pl-[248px]">
        <header className="fixed top-0 left-[248px] right-0 h-16 bg-white border-b border-line z-40 px-8 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]" />
            <input className="input pl-10" placeholder="Search goals, team, blockers..." aria-label="Search" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/checkins" className="btn-primary">
              <Icon name="add" className="text-[18px]" /> Check in
            </Link>
            <Link href="/chat" aria-label="Notifications" className="relative p-2 text-on-surface-variant hover:text-ink hover:bg-surface-container-low rounded-lg">
              <Icon name="notifications" className="text-[22px]" />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-[#BE123C] rounded-full ring-2 ring-white" />}
            </Link>
            <div className="pl-2 border-l border-line"><Avatar name={person.name} size={32} /></div>
          </div>
        </header>
        <main className="pt-16 min-h-screen">
          <div className="px-8 py-8 max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
