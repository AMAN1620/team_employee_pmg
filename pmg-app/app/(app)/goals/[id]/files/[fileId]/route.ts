// Serves a file attached to a goal comment to people who may see the goal. Images, PDFs and plain text open in the
// browser; everything else downloads, so an uploaded page can't run as PMG.
import { currentPersonId } from "@/lib/session";
import { getPerson } from "@/lib/repo";
import { readAttachment } from "@/lib/services/comments";

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const viewer = await currentPersonId();
  const me = viewer ? getPerson(viewer) : undefined;
  if (!me) return new Response("Sign in first", { status: 401 });
  const file = readAttachment(Number(fileId), Number(id), me);
  if (!file) return new Response("Not found", { status: 404 });
  const inline = INLINE.has(file.mime);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": inline ? file.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Length": String(file.bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
