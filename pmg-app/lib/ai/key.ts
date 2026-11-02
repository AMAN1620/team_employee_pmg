import { setting } from "@/lib/env";

/** The Anthropic API key: ANTHROPIC_API_KEY, or anthropic_api_key in .env. */
export const anthropicKey = () => setting("ANTHROPIC_API_KEY", "anthropic_api_key");
