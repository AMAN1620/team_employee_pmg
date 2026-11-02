// Runs once when the Next.js server starts: keeps connected work tools (Jira) in sync every 15 minutes.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSyncLoop } = await import("./lib/services/work");
  startSyncLoop();
}
