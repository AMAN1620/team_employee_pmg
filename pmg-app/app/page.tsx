import { redirect } from "next/navigation";
import { Icon } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";
import { SignInForm } from "@/components/auth/SignInForm";
import { getPerson } from "@/lib/repo";
import { DEMO_ACCOUNTS } from "@/lib/auth";
import { currentPersonId, homeFor } from "@/lib/session";

const NOTES: Record<string, string> = {
  aman: "Associate Developer · goals from Jira, blockers, wins",
  venkatesh: "Aman's manager · approves his weekly goals",
  kanika: "Sr. Manager, Product Marketing · leads a team",
  priya: "Associate Software Engineer · Engineering",
  rupam: "Sr. QA Engineer · Engineering",
};

const POINTS = [
  { icon: "auto_awesome", title: "Goals that plan themselves", text: "PMG turns the work you're given into weekly, monthly and quarterly goals. You just check them." },
  { icon: "report", title: "Unblocked faster", text: "Say what's stuck once. The right person hears about it, and the days you're blocked count in your favour." },
  { icon: "emoji_events", title: "Credit that sticks", text: "Wins, kudos and the blockers you clear for others are saved for review time, with the evidence." },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reset?: string; signedOut?: string; next?: string }> }) {
  const sp = await searchParams;
  const signedIn = await currentPersonId();
  const me = signedIn ? getPerson(signedIn) : undefined;
  if (me) redirect(homeFor(me));
  const demos = DEMO_ACCOUNTS.map((a) => {
    const p = getPerson(a.personId)!;
    return { email: a.email, password: a.password, name: p.name, title: p.title, role: p.role, note: NOTES[a.personId] ?? p.title };
  });

  return (
    <main className="min-h-screen bg-canvas grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-teal text-white p-12">
        <div aria-hidden className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-40 -left-28 w-[480px] h-[480px] rounded-full bg-white/5" />
        <div className="relative"><span className="inline-flex rounded-xl bg-white px-3 py-2"><Logo size={30} /></span></div>
        <div className="relative max-w-lg">
          <p className="text-label-sm uppercase tracking-[0.2em] text-white/70">For the people doing the work</p>
          <h1 className="text-display-lg mt-3 leading-tight">Your goals, your progress, your growth.</h1>
          <ul className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon name={p.icon} className="text-[22px]" /></span>
                <span><span className="block text-title-md">{p.title}</span><span className="block text-body-md text-white/80 mt-0.5">{p.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative inline-flex items-center gap-1.5 text-body-sm text-white/75"><Icon name="shield" className="text-[16px]" /> PMG never tracks keystrokes, screens or online status.</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="lg:hidden mb-8"><Logo size={36} /></div>
          <h2 className="text-headline-lg text-ink">Sign in</h2>
          <p className="text-body-md text-muted mt-1">Acme Labs · use your work email</p>
          {(sp.reset || sp.signedOut) && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-label-md text-teal bg-teal-tint/60 px-3 py-1.5 rounded-full">
              <Icon name={sp.reset ? "restart_alt" : "logout"} className="text-[16px]" /> {sp.reset ? "Demo data reset to Thursday 29 Oct 2026" : "You're signed out"}
            </p>
          )}
          <div className="mt-8"><SignInForm demos={demos} next={sp.next ?? ""} /></div>
        </div>
      </section>
    </main>
  );
}
