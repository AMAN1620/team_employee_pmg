"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { buildPreview, getImportPreview, importRows, storeImportPreview } from "@/lib/services/people";

export async function previewImportAction(f: FormData) {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) redirect("/hr/people");
  const token = storeImportPreview(buildPreview(file.name, await file.text()));
  redirect(`/hr/people?preview=${token}`);
}

export async function importPeopleAction(f: FormData) {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  const preview = getImportPreview(String(f.get("token") ?? ""));
  if (!preview) redirect("/hr/people");
  const n = importRows(preview.ready);
  revalidatePath("/", "layout");
  redirect(`/hr/people?imported=${n}`);
}
