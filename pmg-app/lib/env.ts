// Settings come from the environment, then from .env in this app or the folder above it (the hackathon keeps
// one .env at the repo root, with lowercase keys like jira_token and anthropic_api_key).
import fs from "node:fs";
import path from "node:path";

function envFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [path.join(process.cwd(), "..", ".env"), path.join(process.cwd(), ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return out;
}

/** The first of these settings that's set. */
export function setting(...keys: string[]): string | undefined {
  const files = envFiles();
  return keys.map((k) => process.env[k] || files[k]).find((v) => v);
}
