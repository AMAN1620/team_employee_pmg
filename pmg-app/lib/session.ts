import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPerson, type Person } from "@/lib/repo";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/** Person ids are plain lowercase slugs from the seed; anything else is ignored. */
export function parsePersona(value: string | undefined | null): string | null {
  if (!value) return null;
  return /^[a-z][a-z0-9_-]{0,31}$/.test(value) ? value : null;
}

/** The signed-in person's id, from the signed session cookie. */
export async function currentPersonId(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** The signed-in person, or a redirect to the sign-in page. */
export async function requirePerson(): Promise<Person> {
  const id = await currentPersonId();
  const person = id ? getPerson(id) : undefined;
  if (!person) redirect("/");
  return person;
}

export function homeFor(person: Pick<Person, "role">): string {
  return person.role === "hr" ? "/hr" : person.role === "manager" ? "/team" : "/home";
}
