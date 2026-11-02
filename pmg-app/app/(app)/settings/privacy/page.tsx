import { requirePerson } from "@/lib/session";
import { Card, CardHeader, Icon, PageHeader } from "@/components/ui";
import { preferencesAction } from "@/app/actions/app";

const MATRIX: [string, string, string, string][] = [
  ["Goals and progress", "✓", "✓", "✓"],
  ["Confirmed check-in items", "✓", "✓", "Team totals"],
  ["Raw check-in replies", "✓", "—", "—"],
  ["Wins journal", "✓", "If you share", "—"],
  ["Kudos received", "✓", "If you share", "Team totals"],
  ["Days blocked", "✓", "✓", "Team totals"],
  ["Self-appraisal", "✓", "✓", "After submission"],
];

export default async function PrivacyPage() {
  const me = await requirePerson();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Privacy and sharing" subtitle="You decide what others see." />
      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader title="Who sees what" icon="visibility" />
          <table className="w-full text-left">
            <thead className="text-label-sm text-muted uppercase tracking-wide border-b border-line"><tr><th className="py-2 font-medium" />{["You", "Your manager", "HR"].map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {MATRIX.map(([row, ...cells]) => (
                <tr key={row}><td className="py-3 text-label-md">{row}</td>{cells.map((c, i) => <td key={i} className={`py-3 text-body-md ${c === "✓" ? "text-green-700" : c === "—" ? "text-muted" : "text-amber-700"}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </Card>
        <form action={preferencesAction} className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <CardHeader title="Default visibility for new wins" icon="lock_open" />
            {[["private", "Only me"], ["manager", "Manager"], ["team", "Team"], ["company", "Company"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-body-md py-1"><input type="radio" name="visibility" value={v} defaultChecked={me.default_visibility === v} className="accent-teal" /> {l}</label>
            ))}
          </Card>
          <Card className="p-6">
            <CardHeader title="How do you like to be recognized?" icon="favorite" iconTone="violet" />
            {[["private", "Privately with my manager"], ["team", "In front of my team"], ["company", "Company-wide"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-body-md py-1"><input type="radio" name="recognition" value={v} defaultChecked={me.recognition_pref === v} className="accent-teal" /> {l}</label>
            ))}
          </Card>
          <div className="md:col-span-2"><button className="btn-primary">Save preferences</button></div>
        </form>
        <Card className="p-6">
          <CardHeader title="Connected work tools" icon="hub" />
          {[["Jira", true], ["Google Calendar", false]].map(([t, on]) => (
            <div key={t as string} className="flex items-center justify-between py-2 border-b border-line last:border-0"><span className="text-label-md">{t as string}</span><button className="btn-secondary btn-sm" disabled>{on ? "Disconnect" : "Connect"}</button></div>
          ))}
          <p className="text-body-sm text-muted mt-3">PMG reads only the work items you connect.</p>
        </Card>
        <Card className="p-6 bg-teal-tint/20 border-teal/20">
          <CardHeader title="What PMG never does" icon="shield" />
          <ul className="grid sm:grid-cols-2 gap-2">
            {["No keystroke or screen tracking", "No online-status or hours tracking", "No location tracking", "AI never shares anything you haven't confirmed"].map((x) => (
              <li key={x} className="flex items-center gap-2 text-body-md"><Icon name="block" className="text-[18px] text-teal" /> {x}</li>
            ))}
          </ul>
        </Card>
        <Card className="p-6 flex items-center justify-between">
          <div><p className="text-title-md">Your data</p><p className="text-body-md text-muted">Your achievement record belongs to you.</p></div>
          <a href="/reviews/self" className="btn-secondary"><Icon name="download" className="text-[18px]" /> Export my achievement record</a>
        </Card>
      </div>
    </div>
  );
}
