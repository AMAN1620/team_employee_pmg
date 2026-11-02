// People whose goals PMG plans from Jira in the demo, with their Jira account ids.
// The demo seed loads their tickets from jira/work-items.json (saved by `npm run jira:pull`), so a reset works
// offline; the running app then syncs them live.
export const SEEDED_JIRA: Record<string, { accountId: string; label: string }> = {
  aman: { accountId: "712020:492acd7d-67dd-4e74-add5-2120bae9c395", label: "AMAN KUMAR · aman@herkey.com" },
};
