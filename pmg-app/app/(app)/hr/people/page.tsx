import { requirePerson } from "@/lib/session";
import { Avatar, Card, CardHeader, Icon, PageHeader, Pill, RoleBadge } from "@/components/ui";
import { listPeople, listTeams, peopleById } from "@/lib/repo";
import { previewImportAction, importPeopleAction } from "@/app/actions/people";
import { getImportPreview } from "@/lib/services/people";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ preview?: string; imported?: string; q?: string }> }) {
  await requirePerson();
  const sp = await searchParams;
  const people = listPeople();
  const byId = peopleById();
  const teams = listTeams();
  const preview = sp.preview ? getImportPreview(sp.preview) : null;
  const q = (sp.q ?? "").toLowerCase();
  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={`People · ${teams.reduce((n, t) => n + t.headcount, 0)}`} subtitle="Import your org from a CSV. Teams and reporting lines are built from it." />
      {sp.imported && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Imported {sp.imported} people. They&apos;re matched to chat by email.</div>}

      <Card className="p-6">
        <CardHeader title="Import CSV" icon="upload_file" />
        <form action={previewImportAction} className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="block rounded-xl border-2 border-dashed border-line p-6 text-center cursor-pointer hover:border-teal">
            <Icon name="cloud_upload" className="text-[32px] text-teal" />
            <span className="block text-title-md mt-1">Drop your CSV here or choose a file</span>
            <span className="block text-body-sm text-muted">Columns: name, email, team, manager_email, role</span>
            <input type="file" name="file" accept=".csv,text/csv" required className="mt-3 text-body-sm" />
          </label>
          <div className="space-y-2"><button className="btn-primary w-full">Preview import</button><a href="/acme_employees_sample.csv" download className="btn-ghost btn-sm w-full">Download template</a></div>
        </form>
        {preview && (
          <div className="mt-6">
            <p className="text-title-md mb-3">Column mapping · {preview.file}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {preview.mapping.map(([from, to, ok]) => <Pill key={from} tone={ok ? "green" : "amber"} icon={ok ? "check" : "help"}>{from} → {to}</Pill>)}
            </div>
            <p className="text-body-md">{preview.rows.length} rows · <b>{preview.ready.length} ready</b> · {preview.issues.length} need attention</p>
            {preview.issues.length > 0 && <ul className="mt-2 text-body-sm text-amber-800 list-disc ml-5">{preview.issues.slice(0, 5).map((i) => <li key={i}>{i}</li>)}</ul>}
            <form action={importPeopleAction} className="mt-4"><input type="hidden" name="token" value={sp.preview} /><button className="btn-primary" disabled={!preview.ready.length}>Import {preview.ready.length} people</button></form>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8 overflow-hidden">
          <form className="p-4 border-b border-line"><input name="q" defaultValue={sp.q} placeholder="Search people…" className="input" /></form>
          <table className="w-full text-left">
            <thead className="bg-canvas text-label-sm text-muted uppercase tracking-wide"><tr>{["Name", "Team", "Manager", "PMG role", "Chat"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={p.name} size={30} /><div><p className="text-label-md">{p.name}</p><p className="text-body-sm text-muted">{p.email}</p></div></div></td>
                  <td className="px-4 py-3 text-body-md">{teams.find((t) => t.id === p.team_id)?.name}</td>
                  <td className="px-4 py-3 text-body-md">{byId.get(p.manager_id ?? "")?.name ?? "—"}</td>
                  <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                  <td className="px-4 py-3">{p.chat_connected ? <Icon name="check_circle" className="text-green-600" /> : <Pill tone="amber">Not matched</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="col-span-12 lg:col-span-4 p-6">
          <CardHeader title="Org chart preview" icon="account_tree" />
          <div className="text-body-md">
            <p className="font-semibold">CEO · {byId.get("neha")?.name}</p>
            <ul className="ml-4 mt-2 border-l border-line pl-4 space-y-2">
              {teams.map((t) => <li key={t.id} className="flex justify-between"><span>{t.name}</span><span className="text-muted">{t.headcount}</span></li>)}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
