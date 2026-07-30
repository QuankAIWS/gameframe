import { DiscordSDK } from "@discord/embedded-app-sdk";
import {
  establishDiscordActivitySession,
  type DiscordActivitySdkLike,
} from "../auth/discord-activity-client.ts";

export async function bootstrapDiscordActivitySession() {
  return establishDiscordActivitySession({
    createSdk: (clientId) => new DiscordSDK(clientId) as unknown as DiscordActivitySdkLike,
  });
}
