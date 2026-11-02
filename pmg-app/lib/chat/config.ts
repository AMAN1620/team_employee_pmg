/** Slack is used when both tokens are set (Socket Mode needs the app-level token). */
export function slackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_APP_TOKEN;
}
