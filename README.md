# Scribbles GameFrame

Scribbles GameFrame is the deterministic multiplayer game platform for **Codename Scribbles**. It owns game sessions, legal-action validation, event history, player observations, browser delivery, and the integration boundaries for Discord Activities and Scribbles Runtime. Individual games remain explicit modules rather than being forced into one generalized rules engine.

The first vertical slice is an infrastructure-complete tic-tac-toe implementation. It proves the shared game contract, authoritative session behavior, a perfect deterministic Scribbles opponent, an ordinary browser client, and a transport-neutral HTTP boundary before real Discord and Cloudflare adapters are introduced.

## Current status

Implemented in the initial slice:

- Generic deterministic game-definition contract
- Authoritative revisioned match sessions
- Idempotent action submission and stale-write rejection
- Replayable event history
- Tic-tac-toe rules and player observations
- Explicit two-seat human/agent identity model
- Server-derived request principals and spoof-resistant seat authorization
- Signed, expiring, partitioned Discord Activity session cookies
- Human-versus-human and human-versus-Scribbles match creation
- Perfect deterministic Scribbles opponent
- Storage-neutral asynchronous match service
- In-memory development storage and restorable snapshots
- Cloudflare Worker and Durable Object adapter boundary
- Zero-dependency HTTP server and browser client
- Unit, invariant, service, HTTP integration, and WebSocket projection tests

Not yet claimed:

- Discord Activity OAuth exchange, session establishment, or launch flow
- Deployed Cloudflare Worker or real `workerd` validation
- Scribbles Runtime integration
- Real `workerd` hibernation and deployment behavior
- Canonical self-hosted-runner validation of the current branch

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

## Repository relationship

Scribbles GameFrame and `codename-scribbles-runtime` are peer systems. GameFrame remains independently testable with deterministic or mock participants. Runtime integration must use an explicit, versioned adapter boundary rather than imports from runtime internals.

The repository was originally developed under the Theo GameFrame working name. Active source, configuration, tests, and planning now use the Scribbles namespace; the former name should appear only in historical migration records.

See `AGENTS.md` before consequential development work.
