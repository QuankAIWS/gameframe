# Scribbles GameFrame

Scribbles GameFrame is the deterministic multiplayer game platform for the Codename Scribbles architecture. It owns game sessions, legal-action validation, event history, player observations, browser delivery, and the integration boundaries for Discord Activities and Scribbles Runtime. Individual games remain explicit modules rather than being forced into one generalized rules engine.

Theo is the public-facing Scribbles agent and the first registered nonhuman GameFrame player. The first vertical slice is an infrastructure-complete tic-tac-toe implementation proving the shared game contract, authoritative session behavior, a perfect deterministic Theo fallback opponent, an ordinary browser client, and a transport-neutral HTTP boundary before real Discord and Cloudflare adapters are introduced.

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
- Human-versus-human and human-versus-Theo match creation
- Perfect deterministic Theo fallback opponent
- Storage-neutral asynchronous match service
- In-memory development storage and restorable snapshots
- Cloudflare Worker and Durable Object adapter boundary
- Zero-dependency HTTP server and browser client
- Unit, invariant, service, HTTP integration, and WebSocket projection tests

## Canonical baseline

The repository baseline was canonically validated and merged on July 27, 2026.

- Pull request: `#3`
- Frozen feature head: `d2f404dfb76c03f5568ea3869eaccd6997423005`
- Validated GitHub PR merge ref: `932a1f5e0a185399b0a992ac2807903618ba0661`
- Canonical workflow: run `#8` (`30283559393`)
- Runner: `gh-runner-01`
- Result: complete `npm run validate` job passed
- Artifact uploads: none
- Squash-merged `main` baseline: `01584a43777ddc97a6439101ac4eff79aae1d876`

See `planning/validation/2026-07-27-canonical-baseline.md` for the durable evidence record.

Not yet claimed:

- Discord Activity OAuth exchange, session establishment, or launch flow
- Deployed Cloudflare Worker or real `workerd` validation
- Scribbles Runtime integration controlling Theo
- Real `workerd` hibernation and deployment behavior

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

## Ownership and licensing

This repository is publicly viewable proprietary software. Copyright remains with the applicable copyright owner, and all rights are reserved.

No open-source license is granted. The absence of a `LICENSE` file is intentional. Viewing, cloning, or forking the repository through GitHub does not grant permission to reuse, modify, redistribute, sell, deploy, or create derivative works from the code except as required for GitHub's own repository functionality or with prior written authorization.

See `NOTICE` for the controlling repository notice and `CONTRIBUTING.md` for the current external-contribution policy.

## Security and deployment data

The public repository must not contain production credentials, private keys, access tokens, cookies, private user or campaign data, incident records, or secret-bearing environment files. Deployment secrets belong in GitHub, Cloudflare, or equivalent secret stores and are supplied through environment bindings.

Security vulnerabilities should be reported through the private process in `SECURITY.md`, not through a public issue containing exploit details.

## Repository relationship

Scribbles GameFrame and `codename-scribbles-runtime` are peer systems. GameFrame remains independently testable with deterministic or mock participants. Scribbles Runtime integrates through an explicit, versioned adapter and acts on behalf of Theo; it does not become the game authority or the player identity.

The retired Theo GameFrame and OpenClaw names remain available in Git history and historical validation records. Active source, configuration, and architecture use the Scribbles namespace for the platform while preserving Theo as the agent.

See `AGENTS.md` before consequential development work.
