import { requirePerson } from "@/lib/session";
import { Card, CardHeader, Icon, PageHeader, Pill } from "@/components/ui";
import { get } from "@/lib/db";
import { setting } from "@/lib/repo";
import { slackConfigured } from "@/lib/chat/config";
import { chatSettingsAction, sendCheckinPromptsAction } from "@/app/actions/app";

const FEATURES: [string, string, string][] = [
  ["checkin", "Weekly check-in", "Three questions, answered in plain text"],
  ["blockers", "Blocker requests", "Accept / Need info / Not me buttons"],
  ["kudos", "Kudos command", "/kudos @name for …"],
  ["feedback", "Feedback requests and prompts", "Ask for feedback; nudges after milestones"],
  ["reminders", "1:1 and action reminders", "A day before actions are due"],
  ["approvals", "Goal approvals", "Approve / Request changes from chat"],
  ["reviews", "Review-cycle reminders", "Before self and manager deadlines"],
];

const TOOLS: [string, string, string][] = [
  ["Jira", "confirmation_number", "Pre-fill check-ins with tickets you closed"],
  ["GitHub", "code", "Pre-fill check-ins with merged work"],
  ["Google Calendar", "calendar_month", "Find 1:1s automatically"],
  ["Google Sheets / Excel", "table_chart", "Two-way goal sync for teams that track goals in a sheet"],
  ["CRM", "handshake", "Pull closed deals into wins"],
];

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ saved?: string; prompted?: string }> }) {
  await requirePerson();
  const sp = await searchParams;
  const matched = get<{ n: number }>("SELECT COUNT(*) AS n FROM people WHERE chat_connected = 1")?.n ?? 0;
  const modelled = get<{ n: number }>("SELECT COUNT(*) AS n FROM people")?.n ?? 0;
  const slack = slackConfigured();

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" subtitle="Connect your chat tool so check-ins, blockers and kudos happen where people already work." />
      {sp.saved && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Chat settings saved.</div>}
      {sp.prompted && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Check-in prompts sent to everyone who hasn&apos;t got one open.</div>}

      <div>
        <h2 className="label">Chat tool · required</h2>
        <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4A154B] text-white flex items-center justify-center"><Icon name="tag" className="text-[26px]" /></div>
              <div className="flex-1">
                <p className="text-title-md">{slack ? "Slack workspace" : "PMG chat simulator"}: {setting("chat.workspace")}</p>
                <div className="flex flex-wrap gap-2 mt-1 items-center">
                  <Pill tone="green" icon="check_circle">Connected</Pill>
                  <span className="text-body-md">Matched by email: {304 - (modelled - matched)} of 312 people</span>
                  <span className="text-body-md text-amber-700">{8 + (modelled - matched)} not matched</span>
                </div>
                <p className="text-body-sm text-muted mt-2">{slack ? "Messages are posted to Slack and mirrored in PMG's Chat page." : "No Slack tokens set, so messages go to the built-in chat (Chat in the sidebar). Set SLACK_BOT_TOKEN and SLACK_APP_TOKEN and run `npm run slack` to use Slack."}</p>
              </div>
              <form action={sendCheckinPromptsAction}><button className="btn-secondary"><Icon name="send" className="text-[18px]" /> Send check-in prompts now</button></form>
            </div>
          </Card>
          <Card className="p-6 opacity-70">
            <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-[#4B53BC] text-white flex items-center justify-center"><Icon name="groups" className="text-[26px]" /></div>
              <div><p className="text-title-md">Microsoft Teams</p><Pill tone="slate">Coming soon</Pill></div></div>
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader title="What PMG does in chat" icon="chat" />
        <form action={chatSettingsAction}>
          <ul className="divide-y divide-line">
            {FEATURES.map(([key, label, sub]) => (
              <li key={key} className="py-3 flex items-center gap-4">
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input type="checkbox" name={key} defaultChecked={setting(`chat.feature.${key}`) !== "0"} className="peer sr-only" />
                  <span className="w-10 h-6 rounded-full bg-slate-200 relative transition-colors peer-checked:bg-teal after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                  <span><span className="text-label-md block">{label}</span><span className="text-body-sm text-muted">{sub}</span></span>
                </label>
                {key === "checkin" && <input name="schedule" defaultValue={setting("chat.checkin_schedule")} className="input w-56" aria-label="Check-in schedule" />}
              </li>
            ))}
          </ul>
          <label className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-line">
            <span className="flex-1 min-w-64"><span className="text-label-md block">Where PMG notifies people</span><span className="text-body-sm text-muted">Blocker requests, reminders and nudges go out in PMG chat and here. Mocked in this prototype: messages are shown on each blocker, not sent.</span></span>
            <select name="channel" defaultValue={setting("notify.channel") || "slack"} className="input w-48">
              <option value="slack">Slack</option><option value="google_chat">Google Chat</option><option value="email">Email</option>
            </select>
          </label>
          <button className="btn-primary mt-4">Save chat settings</button>
        </form>
      </Card>

      <div>
        <h2 className="label">Work tools · optional</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map(([name, icon, desc]) => (
            <Card key={name} className="p-5 flex flex-col">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-surface-container-low text-teal flex items-center justify-center"><Icon name={icon} /></div><p className="text-title-md flex-1">{name}</p><button className="btn-secondary btn-sm" disabled title="Mock in the prototype">Connect</button></div>
              <p className="text-body-md mt-3 flex-1">{desc}</p>
              <p className="text-body-sm text-muted mt-3">Employees choose what to connect. PMG reads work items only, never activity.</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
