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
- Storage-neutral asynchronous match service
- In-memory development storage and restorable snapshots
- Cloudflare Worker and Durable Object adapter boundary
- Zero-dependency HTTP server and browser client
- Unit, invariant, service, HTTP integration, and WebSocket projection tests

Not yet claimed:

- Discord Activity authentication or launch flow
- Deployed Cloudflare Worker or real `workerd` validation
- OpenClaw runtime integration
- Real `workerd` hibernation and deployment behavior
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
planning/                 architecture, deployment, roadmap, and validation doctrine
src/cloudflare/           Worker, Durable Object, and storage adapters
```

See `AGENTS.md` before consequential development work.
