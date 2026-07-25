# Theo GameFrame

Theo GameFrame is the deterministic multiplayer game platform for Theo. It owns game sessions, legal-action validation, event history, player observations, browser delivery, and the integration boundaries for Discord Activities and OpenClaw. Individual games remain explicit modules rather than being forced into one generalized rules engine.

The first vertical slice is an infrastructure-complete tic-tac-toe implementation. It proves the shared game contract, authoritative session behavior, a perfect deterministic Theo opponent, an ordinary browser client, and a transport-neutral HTTP boundary before real Discord and Cloudflare adapters are introduced.

## Current status

Implemented in the initial slice:

- Generic deterministic game-definition contract
- Authoritative revisioned match sessions
- Idempotent action submission and stale-write rejection
- Replayable event history
- Tic-tac-toe rules and player observations
- Perfect deterministic Theo opponent
- In-memory match service
- Zero-dependency HTTP server and browser client
- Unit, invariant, service, and HTTP integration tests

Not yet claimed:

- Discord Activity authentication or launch flow
- Cloudflare Worker or Durable Object deployment
- OpenClaw runtime integration
- Durable persistence across process restarts
- Canonical self-hosted-runner validation

## Run locally

Requires Node.js 22.16.0 or newer. The current slice deliberately has no package dependencies.

```bash
npm test
npm run validate
npm run dev
```

Open `http://127.0.0.1:8787` after starting the development server.

## Repository map

```text
src/platform/             shared game and match contracts
src/games/tic-tac-toe/   first deterministic game module
src/agents/               nonhuman player contracts and implementations
src/server/               authoritative development service and HTTP host
src/scripts/              repository self-checks
public/                   standalone browser shell
planning/                 architecture, roadmap, and validation doctrine
```

See `AGENTS.md` before consequential development work.
