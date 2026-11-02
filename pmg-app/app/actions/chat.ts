"use server";

import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/session";
import { get } from "@/lib/db";
import { handleButton, handleCheckinReply, handleTypedMessage } from "@/lib/chat/commands";
import type { ChatMessage } from "@/lib/repo";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function chatCheckinAction(f: FormData) {
  const me = await requirePerson();
  const mood = Number(s(f, "mood")) || null;
  await handleCheckinReply(me, { moved: s(f, "moved"), stuck: s(f, "stuck"), next: s(f, "next"), mood });
  revalidatePath("/", "layout");
}

export async function chatSendAction(f: FormData) {
  const me = await requirePerson();
  handleTypedMessage(me, s(f, "text"));
  revalidatePath("/", "layout");
}

export async function chatButtonAction(f: FormData) {
  const me = await requirePerson();
  const msg = get<ChatMessage>("SELECT * FROM chat_messages WHERE id = ?", Number(s(f, "messageId")));
  if (!msg) return;
  handleButton(me, msg, s(f, "op"), s(f, "note") || undefined);
  revalidatePath("/", "layout");
}
