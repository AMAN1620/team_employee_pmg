"use client";
// Email and password, with the demo accounts one click away (the button fills the form; you still sign in).
import { useActionState, useState } from "react";
import { Avatar, Icon, RoleBadge } from "@/components/ui";
import { signInAction } from "@/app/actions/session";

type Demo = { email: string; password: string; name: string; title: string; role: string; note: string };

export function SignInForm({ demos, next }: { demos: Demo[]; next: string }) {
  const [state, action, pending] = useActionState(signInAction, { error: null, email: "" });
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="label">Work email</span>
          <span className="relative block">
            <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted" />
            <input name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@acmelabs.in" className="input pl-10" />
          </span>
        </label>
        <label className="block">
          <span className="label">Password</span>
          <span className="relative block">
            <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted" />
            <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10 pr-10" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink">
              <Icon name={show ? "visibility_off" : "visibility"} className="text-[18px]" />
            </button>
          </span>
        </label>
        {state.error && <p role="alert" className="text-body-sm text-rose-700 flex items-center gap-1"><Icon name="error" className="text-[16px]" />{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full h-11">{pending ? "Signing in…" : <>Sign in <Icon name="arrow_forward" className="text-[18px]" /></>}</button>
        <div className="flex items-center gap-3 text-body-sm text-muted"><span className="flex-1 h-px bg-line" />or<span className="flex-1 h-px bg-line" /></div>
        <button type="button" disabled className="btn-secondary w-full h-11 opacity-60 cursor-not-allowed" title="Company sign-in (Google Workspace) comes later">
          <Icon name="domain" className="text-[18px]" /> Sign in with company account <span className="text-body-sm">(soon)</span>
        </button>
      </form>

      <div className="rounded-xl border border-dashed border-teal/40 bg-teal-tint/20 p-4">
        <p className="text-label-sm text-teal uppercase tracking-wide flex items-center gap-1"><Icon name="key" className="text-[16px]" /> Demo accounts</p>
        <ul className="mt-3 space-y-3">
          {demos.map((d) => (
            <li key={d.email} className="flex items-center gap-3">
              <Avatar name={d.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-label-md flex items-center gap-2">{d.name} <RoleBadge role={d.role} /></p>
                <p className="text-body-sm text-muted truncate">{d.note}</p>
                <p className="text-body-sm font-mono text-ink/80 mt-0.5">{d.email} · {d.password}</p>
              </div>
              <button type="button" onClick={() => { setEmail(d.email); setPassword(d.password); }} className="btn-secondary btn-sm">Use</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
