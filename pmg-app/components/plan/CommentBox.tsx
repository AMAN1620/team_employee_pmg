"use client";
// The box under a goal's comments: write a comment, attach files (picked or dropped), post without leaving the page.
import { useActionState, useEffect, useRef, useState } from "react";
import type { CommentState } from "@/app/actions/comments";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function CommentBox({ goalId, action, placeholder, maxFiles, maxBytes }: {
  goalId: number; action: (prev: CommentState, f: FormData) => Promise<CommentState>; placeholder: string; maxFiles: number; maxBytes: number;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, error: null, at: 0 });
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // After a successful post, clear the box.
  useEffect(() => {
    if (state.ok) { form.current?.reset(); setFiles([]); }
  }, [state]);

  // The file input posts what's listed, so it's kept in step with the chips.
  const apply = (keep: File[]) => {
    const dt = new DataTransfer();
    keep.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setFiles(keep);
  };
  const choose = (list: File[]) => {
    const next = [...files, ...list].slice(0, maxFiles);
    const big = next.find((f) => f.size > maxBytes);
    setProblem(big ? `${big.name} is over ${maxBytes / 1024 / 1024} MB` : files.length + list.length > maxFiles ? `Up to ${maxFiles} files at a time` : null);
    apply(next.filter((f) => f.size <= maxBytes));
  };

  return (
    <form ref={form} action={formAction}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); choose([...e.dataTransfer.files]); }}
      className={`rounded-xl border p-3 transition-colors ${dragging ? "border-teal bg-teal-tint/40" : "border-line bg-white focus-within:border-teal"}`}>
      <input type="hidden" name="goalId" value={goalId} />
      <textarea name="body" rows={3} placeholder={placeholder} className="w-full resize-y bg-transparent text-body-md outline-none placeholder:text-muted" />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2 py-1 text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-teal" aria-hidden>{f.type.startsWith("image/") ? "image" : "description"}</span>
              <span className="max-w-[180px] truncate">{f.name}</span><span className="text-muted">{kb(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} className="text-muted hover:text-ink" onClick={() => { setProblem(null); apply(files.filter((_, j) => j !== i)); }}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden>close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-line">
        <label className="btn-ghost btn-sm cursor-pointer text-muted hover:text-ink">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>attach_file</span> Attach files
          <input ref={input} type="file" name="files" multiple className="sr-only" onChange={(e) => { const picked = [...(e.target.files ?? [])]; e.target.value = ""; choose(picked); }} />
        </label>
        <span className="text-body-sm text-muted hidden sm:inline">or drop them here · up to {maxFiles}, {maxBytes / 1024 / 1024} MB each</span>
        <button disabled={pending} className="btn-primary btn-sm ml-auto">{pending ? "Posting…" : "Post"}</button>
      </div>
      {(problem || state.error) && <p className="text-body-sm text-rose-700 mt-2">{problem ?? state.error}</p>}
    </form>
  );
}
