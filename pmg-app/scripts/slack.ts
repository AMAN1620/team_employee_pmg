// Starts the Slack bridge. Needs SLACK_BOT_TOKEN (xoxb-…) and SLACK_APP_TOKEN (xapp-…, Socket Mode).
import { slackConfigured } from "../lib/chat/config";
import { startSlack } from "../lib/chat/slack";

if (!slackConfigured()) {
  console.error("Set SLACK_BOT_TOKEN and SLACK_APP_TOKEN first. Without them PMG uses its built-in chat (the Chat page).");
  process.exit(1);
}
startSlack().catch((e) => {
  console.error(e);
  process.exit(1);
});
