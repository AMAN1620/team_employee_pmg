import Link from "next/link";

/** Renders text with [n] citations as chips that open that source in the evidence panel. */
export function CitedText({ text, base = "/reviews/self" }: { text: string; base?: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-body-md leading-7 rounded-lg bg-canvas border border-line p-4">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const sep = base.includes("?") ? "&" : "?";
        return (
          <Link key={i} href={`${base}${sep}cite=${m[1]}`} scroll={false}
            className="inline-flex items-center h-5 px-1.5 mx-0.5 rounded bg-teal-tint text-teal text-[11px] font-semibold align-middle hover:bg-teal hover:text-white">
            {m[1]}
          </Link>
        );
      })}
    </p>
  );
}
