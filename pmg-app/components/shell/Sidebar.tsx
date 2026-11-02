"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Icon, RoleBadge, cx } from "@/components/ui";
import { Logo } from "./Logo";
import { resetDemo, signOutAction } from "@/app/actions/session";

export type NavItem = { href: string; label: string; icon: string; badge?: number; divider?: string };

export function Sidebar({ nav, person }: {
  nav: NavItem[];
  person: { id: string; name: string; title: string; role: string };
}) {
  const path = usePathname();
  // The most specific nav item that matches the current path is active.
  const active = nav
    .filter((n) => path === n.href || path.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[248px] bg-white border-r border-line z-50 flex flex-col">
      <div className="h-16 px-6 flex items-center border-b border-line">
        <Link href="/" aria-label="PMG home"><Logo /></Link>
      </div>
      <nav className="p-2 flex-1 overflow-y-auto space-y-0.5">
        {nav.map((n) => (
          <div key={n.href}>
            {n.divider && <div className="px-4 pt-4 pb-1 text-label-sm text-muted uppercase tracking-wide">{n.divider}</div>}
            <Link
              href={n.href}
              className={cx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-label-md transition-colors",
                active === n.href ? "bg-surface-container-low text-teal font-semibold" : "text-on-surface-variant hover:bg-surface-container-low hover:text-ink",
              )}
            >
              <Icon name={n.icon} fill={active === n.href} />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="min-w-5 h-5 px-1.5 rounded-full bg-teal text-white text-[11px] font-semibold flex items-center justify-center">{n.badge}</span>}
            </Link>
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-line">
        <div className="p-2 rounded-xl bg-surface-container-low/60">
          <div className="flex items-center gap-2">
            <Avatar name={person.name} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-label-md font-semibold truncate">{person.name}</span>
                <RoleBadge role={person.role} />
              </div>
              <p className="text-body-sm text-muted truncate">{person.title}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line/60 grid grid-cols-3 gap-1">
            <form action={signOutAction}>
              <button className="w-full flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-label-sm text-teal hover:bg-white"><Icon name="logout" className="text-[18px]" />Sign out</button>
            </form>
            {person.role !== "hr" ? <Link href="/settings/privacy" className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-label-sm text-muted hover:bg-white hover:text-teal"><Icon name="lock" className="text-[18px]" />Privacy</Link> : <span />}
            <form action={resetDemo}>
              <button className="w-full flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-label-sm text-muted hover:bg-white hover:text-teal" title="Start the demo over (signs you out)"><Icon name="restart_alt" className="text-[18px]" />Reset</button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
