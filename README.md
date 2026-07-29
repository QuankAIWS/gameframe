# Scribbles GameFrame

Scribbles GameFrame is the deterministic multiplayer game platform for the Scribbles architecture. It owns game sessions, legal-action validation, event history, player observations, browser delivery, and the integration boundaries for Discord Activities and Scribbles Runtime. Individual games remain explicit modules rather than being forced into one generalized rules engine.

Theo is the public-facing Scribbles agent and the first registered nonhuman GameFrame player. The initial platform proof now includes complete Tic-Tac-Toe browser behavior and a versioned, transport-neutral decision-provider contract that deterministic mocks and the future Scribbles Runtime adapter can implement without becoming game authority.

## Current status

Implemented in the initial platform, browser, and agent-contract proofs:

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
- Persistent development-browser seats and URL-based match resume
- Shareable synthetic second-player links for development testing
- HTTP polling fallback and WebSocket projection reconnect behavior
- Responsive desktop and mobile tic-tac-toe interface
- Storage-neutral asynchronous match service
- In-memory development storage and restorable snapshots
- Cloudflare Worker and Durable Object adapter boundary
- Real Playwright browser acceptance through the ordinary application boundary
- Version-1 agent decision request and response protocol
- Provider-side correlation, identity, revision, legality, action-ID, duplicate, timeout, and malformed-response validation
- Deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, stale, and mismatched mock-provider modes
- Canonical JSON fixtures for independent Scribbles Runtime compatibility work
- Unit, invariant, service, HTTP integration, WebSocket projection, agent-provider, browser, and real Workers-runtime tests

The active game-module milestone is American Checkers. The standalone Cloudflare and Discord canaries remain paused until the repository owner is available for deployment setup; they are not treated as complete.

## Canonical checkpoints

- Initial repository baseline validated and merged on July 27, 2026
- Complete Tic-Tac-Toe browser proof validated and merged on July 29, 2026
- Versioned agent decision contract and durable mock provider validated and merged on July 29, 2026

Durable evidence:

- `planning/validation/2026-07-27-canonical-baseline.md`
- `planning/validation/2026-07-29-tic-tac-toe-browser-proof.md`
- `planning/validation/2026-07-29-agent-decision-contract.md`

Not yet claimed:

- Standalone deployed Cloudflare Worker validation
- Discord Activity OAuth exchange, session establishment, or launch flow
- Remote decision-provider network transport and authentication
- Live Scribbles Runtime integration controlling Theo
- Production recovery, quota, and durability behavior

## Run locally

Requires Node.js 22.16.0 or newer.

```bash
npm ci
npx playwright install chromium
npm test
npm run test:workerd
npm run test:browser
npm run validate
npm run dev
```

Open `http://127.0.0.1:8787` after starting the development server.

## Repository map

```text
src/platform/             shared game and match contracts
src/games/tic-tac-toe/   first deterministic game module
src/agents/               versioned decision contracts, mocks, and agent implementations
src/server/               authoritative development service and HTTP host
src/scripts/              repository self-checks
public/                   standalone responsive browser client
test/browser/             real Playwright browser acceptance
test/fixtures/            cross-repository compatibility fixtures
test/workerd/             real Workers-runtime integration tests
planning/                 architecture, deployment, roadmap, protocol, and validation doctrine
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

Scribbles GameFrame and Scribbles Runtime are peer systems. GameFrame remains independently testable with deterministic or mock participants. Scribbles Runtime integrates through the explicit versioned decision-provider contract and acts on behalf of Theo; it does not become the game authority or the player identity.

See `AGENTS.md` before consequential development work.
