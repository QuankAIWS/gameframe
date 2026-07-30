import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const sessionSecret = "gf0002-workerd-session-secret-0123456789abcdef";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          SESSION_SECRET: sessionSecret,
          DISCORD_CLIENT_ID: "123456789012345678",
          DISCORD_CLIENT_SECRET: "workerd-discord-client-secret",
          DISCORD_ALLOWED_USER_IDS: "111,222",
        },
      },
    }),
  ],
  test: {
    include: ["test/workerd/**/*.test.ts"],
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
