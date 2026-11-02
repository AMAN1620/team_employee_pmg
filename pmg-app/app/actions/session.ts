"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, resetDb, run } from "@/lib/db";
import { getPerson } from "@/lib/repo";
import { DECOY_HASH, SESSION_COOKIE, SESSION_DAYS, signSession, verifyPassword } from "@/lib/auth";
import { homeFor, requirePerson } from "@/lib/session";
import { now } from "@/lib/time";

export type SignInState = { error: string | null; email: string };

/** Email and password. A wrong email and a wrong password get the same answer, in about the same time. */
export async function signInAction(_prev: SignInState, f: FormData): Promise<SignInState> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const account = get<{ person_id: string; password_hash: string }>("SELECT person_id, password_hash FROM accounts WHERE email = ?", email);
  const ok = verifyPassword(password, account?.password_hash ?? DECOY_HASH) && !!account;
  const person = ok ? getPerson(account!.person_id) : undefined;
  if (!person) return { error: "That email and password don't match. Check them and try again.", email };
  run("UPDATE accounts SET last_sign_in_at = ? WHERE person_id = ?", now(), person.id);
  (await cookies()).set(SESSION_COOKIE, signSession(person.id), {
    path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: SESSION_DAYS * 86_400,
  });
  const next = String(f.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : homeFor(person));
}

export async function signOutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?signedOut=1");
}

/** Starts the demo over. Only someone signed in can do it; they're signed out after. */
export async function resetDemo() {
  await requirePerson();
  resetDb();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?reset=1");
}
