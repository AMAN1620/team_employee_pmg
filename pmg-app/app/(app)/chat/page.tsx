import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, Icon, cx, fmtDate, fmtTime } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";
import { chatFor, getBlocker, getPerson, peopleById, type ChatMessage, type Person } from "@/lib/repo";
import { displayStatus } from "@/lib/logic/blocked";
import { today } from "@/lib/time";
import { slackConfigured } from "@/lib/chat/config";
import { chatButtonAction, chatCheckinAction, chatSendAction } from "@/app/actions/chat";

export default async function ChatPage() {
  const me = await requirePerson();
  return (
    <div>
      <Header me={me} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8"><Thread person={me} me={me} /></div>
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="card p-5">
            <p className="text-title-md mb-2">Try it</p>
            <ul className="space-y-2 text-body-md text-on-surface-variant">
              <li><code className="px-1.5 py-0.5 rounded bg-canvas border border-line text-[13px]">/kudos @salman for the onboarding designs</code></li>
              <li><code className="px-1.5 py-0.5 rounded bg-canvas border border-line text-[13px]">/blocker @poonam need the support-ticket export</code></li>
              <li>Answer the check-in card when PMG asks</li>
            </ul>
          </div>
          <div className="card p-5 text-body-md text-muted">
            <p className="text-title-md text-ink mb-1">Other people&apos;s side</p>
            {me.role === "manager" ? "Requests from your team (goal approvals, blockers, tickets joining an approved week) arrive here with buttons." : "Sign in as your manager in another browser window to approve a goal you send, straight from chat."}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Header({ me }: { me: Person }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="page-title">Chat</h1>
        <p className="text-body-md text-muted mt-1">{slackConfigured() ? "Mirrors your Slack DM with the PMG app." : "PMG's built-in chat. With Slack connected, these messages arrive in Slack instead."}</p>
      </div>
      <span className="sr-only">{me.name}</span>
    </div>
  );
}

function Thread({ person, me, compact }: { person: Person; me: Person; compact?: boolean }) {
  const people = peopleById();
  const messages = chatFor(person.id);
  const canAct = person.id === me.id;
  const shown = compact ? messages.slice(-6) : messages;
  return (
    <div className="rounded-xl overflow-hidden border border-slate-300 bg-white shadow-card flex flex-col" style={{ height: compact ? 640 : "calc(100vh - 200px)" }}>
      <div className="h-12 bg-slate-800 text-white flex items-center gap-2 px-4">
        <span className="w-7 h-7 rounded-md bg-teal flex items-center justify-center"><Icon name="trending_up" className="text-[18px]" /></span>
        <span className="text-label-md">PMG</span><span className="text-body-sm text-slate-300">· app · DM with {person.name}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white flex flex-col-reverse">
        <div className="space-y-4">
          {shown.map((m, i) => {
            const prevDay = i > 0 ? shown[i - 1].at.slice(0, 10) : null;
            return (
              <div key={m.id}>
                {m.at.slice(0, 10) !== prevDay && <p className="text-center text-body-sm text-muted my-2">{m.at.slice(0, 10) === today() ? "Today" : fmtDate(m.at, { weekday: "long", day: "numeric", month: "short" })}</p>}
                <Message m={m} people={people} canAct={canAct} owner={person} />
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-center text-body-md text-muted py-10">No messages yet.</p>}
        </div>
      </div>
      {canAct && !compact && (
        <form action={chatSendAction} className="border-t border-slate-200 p-3 flex gap-2">
          <input name="text" autoComplete="off" placeholder="Message PMG… try /kudos @salman for the designs" className="input" />
          <button className="btn-primary" aria-label="Send"><Icon name="send" className="text-[18px]" /></button>
        </form>
      )}
    </div>
  );
}

function Message({ m, people, canAct, owner }: { m: ChatMessage; people: Map<string, Person>; canAct: boolean; owner: Person }) {
  const mine = m.from_id !== "pmg";
  const data = JSON.parse(m.data) as Record<string, unknown>;
  const who = mine ? people.get(m.from_id)?.name ?? "" : "PMG";
  return (
    <div className="flex gap-3">
      {mine ? <Avatar name={who} size={34} /> : <span className="w-[34px] h-[34px] rounded-md bg-teal flex items-center justify-center shrink-0"><Icon name="trending_up" className="text-[20px] text-white" /></span>}
      <div className="flex-1 min-w-0">
        <p className="text-label-md">{who} {!mine && <span className="px-1 rounded bg-slate-100 text-[10px] text-muted font-semibold align-middle">APP</span>} <span className="text-body-sm text-muted font-normal">{fmtTime(m.at)}</span></p>
        <Body m={m} data={data} canAct={canAct} owner={owner} />
      </div>
    </div>
  );
}

function Btn({ m, op, label, primary, danger }: { m: ChatMessage; op: string; label: string; primary?: boolean; danger?: boolean }) {
  return (
    <form action={chatButtonAction}>
      <input type="hidden" name="messageId" value={m.id} /><input type="hidden" name="op" value={op} />
      <button className={cx("h-8 px-3 rounded-md border text-label-md", primary ? "bg-teal text-white border-teal hover:bg-teal-hover" : danger ? "border-rose-300 text-rose-700 hover:bg-rose-50" : "border-slate-300 hover:bg-slate-50")}>{label}</button>
    </form>
  );
}

function Done({ text }: { text: string }) {
  return <p className="mt-2 text-body-sm text-muted inline-flex items-center gap-1"><Icon name="check_circle" className="text-[16px] text-green-600" /> {text}</p>;
}

function Body({ m, data, canAct, owner }: { m: ChatMessage; data: Record<string, unknown>; canAct: boolean; owner: Person }) {
  const card = "mt-1 rounded-lg border border-slate-200 border-l-4 p-3";
  switch (m.kind) {
    case "checkin_prompt":
      return (
        <div className={cx(card, "border-l-teal")}>
          <p className="text-body-md">{m.body}</p>
          {!m.handled && canAct ? (
            <form action={chatCheckinAction} className="mt-3 space-y-2">
              <textarea name="moved" required placeholder="What moved?" className="textarea min-h-[60px]" />
              <textarea name="stuck" placeholder="What's stuck?" className="textarea min-h-[60px]" />
              <textarea name="next" placeholder="What's next?" className="textarea min-h-[48px]" />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-body-sm text-muted mr-1">How was your week?</span>
                {["😣", "😕", "😐", "🙂", "😄"].map((e, i) => (
                  <label key={i} className="cursor-pointer"><input type="radio" name="mood" value={i + 1} defaultChecked={i === 3} className="peer sr-only" />
                    <span className="block w-9 h-9 rounded-md border border-slate-200 text-[18px] text-center leading-9 peer-checked:border-teal peer-checked:bg-teal-tint">{e}</span></label>
                ))}
              </div>
              <button className="btn-primary btn-sm">Send</button>
            </form>
          ) : m.handled ? <Done text="Answered" /> : null}
        </div>
      );
    case "checkin_sorted": {
      const lines = (data.lines as string[]) ?? [];
      return (
        <div className={cx(card, "border-l-teal")}>
          <p className="text-title-md">{m.body}</p>
          <ul className="mt-2 space-y-1">{lines.map((l) => <li key={l} className="text-body-md"><b>{l.split(":")[0]}</b> →{l.slice(l.indexOf(":") + 1)}</li>)}</ul>
          {!m.handled && canAct ? (
            <div className="flex gap-2 mt-3"><Btn m={m} op="confirm" label="Looks right" primary /><Link href="/checkins" className="h-8 px-3 rounded-md border border-slate-300 text-label-md inline-flex items-center hover:bg-slate-50">Edit in PMG</Link></div>
          ) : m.handled ? <Done text="Confirmed" /> : null}
        </div>
      );
    }
    case "blocker_request": {
      const b = data.blockerId ? getBlocker(Number(data.blockerId)) : undefined;
      const status = b ? displayStatus(b, today()) : null;
      return (
        <div className={cx(card, "border-l-rose-500")}>
          <p className="text-title-md">{m.body}</p>
          {b && <p className="text-body-sm text-muted mt-1">{data.goal ? `Goal: ${data.goal} · ` : ""}Need by {fmtDate(b.need_by)}{b.details ? ` · ${b.details}` : ""}</p>}
          {b?.status === "resolved" ? <Done text="Resolved" /> : canAct && !m.handled ? (
            <div className="flex flex-wrap gap-2 mt-3"><Btn m={m} op="accept" label="Accept" primary /><Btn m={m} op="needs_info" label="Need info" /><Btn m={m} op="not_me" label="Not me" danger /></div>
          ) : canAct && m.handled === "accept" ? (
            <div className="flex items-center gap-2 mt-2"><Done text={`Accepted${status === "overdue" ? " · now overdue" : ""}`} /><Btn m={m} op="resolve" label="Mark resolved" primary /></div>
          ) : m.handled ? <Done text={m.handled === "needs_info" ? "Asked for more info" : m.handled === "not_me" ? "Passed on" : m.handled === "resolved" ? "Resolved" : "Accepted"} /> : null}
        </div>
      );
    }
    case "approval_request":
      return (
        <div className={cx(card, "border-l-violet")}>
          <p className="text-title-md">{m.body}</p>
          {canAct && !m.handled ? (
            <div className="flex flex-wrap gap-2 mt-3"><Btn m={m} op="approve" label="Approve" primary /><Btn m={m} op="changes" label="Request changes" />
              <Link href={`/approvals/${String(data.goalId)}`} className="h-8 px-3 rounded-md border border-slate-300 text-label-md inline-flex items-center hover:bg-slate-50">Open in PMG</Link></div>
          ) : m.handled ? <Done text={m.handled === "approve" ? "Approved" : m.handled === "changes" ? "Changes requested" : "Done"} /> : null}
        </div>
      );
    case "plan_change":
      return (
        <div className={cx(card, "border-l-violet")}>
          <p className="text-title-md">{m.body}</p>
          {canAct && !m.handled ? (
            <div className="flex flex-wrap gap-2 mt-3"><Btn m={m} op="approve" label="Approve" primary />
              <Link href={`/team/${String(data.personId)}`} className="h-8 px-3 rounded-md border border-slate-300 text-label-md inline-flex items-center hover:bg-slate-50">Open their plan</Link></div>
          ) : m.handled ? <Done text="Approved" /> : null}
        </div>
      );
    case "kudos_notice":
      return <div className={cx(card, "border-l-violet bg-violet-tint/40")}><p className="text-body-md">💜 {m.body}</p></div>;
    case "feedback_request":
      return (
        <div className={cx(card, "border-l-amber-500")}>
          <p className="text-body-md">{m.body}</p>
          {canAct && !m.handled && <Link href={`/feedback?give=${String(data.personId ?? "")}&goalId=${String(data.goalId ?? "")}&requestId=${String(data.requestId ?? "")}`} className="mt-2 inline-flex h-8 px-3 rounded-md bg-teal text-white text-label-md items-center">Give feedback</Link>}
        </div>
      );
    default:
      return (
        <div className={cx(m.from_id === "pmg" && m.kind !== "text" && card, m.from_id === "pmg" && m.kind !== "text" && "border-l-slate-400")}>
          <p className="text-body-md whitespace-pre-wrap">{m.body}</p>
          {typeof data.href === "string" && <Link href={data.href} className="text-label-md text-teal hover:underline">Open in PMG →</Link>}
          {owner && null}
        </div>
      );
  }
}
