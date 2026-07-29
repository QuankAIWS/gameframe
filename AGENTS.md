# AGENTS.md — Scribbles GameFrame

Scribbles GameFrame is the publicly viewable, proprietary game platform used by Theo and the wider Scribbles architecture. It is not a generalized public game engine, plugin marketplace, or production SaaS platform. The immediate objective is to prove the complete multiplayer and integration architecture with small, deterministic games before expanding into tactical, chess, RPG, or RTS modules.

## Startup

1. Read this file.
2. Read `planning/ROADMAP.md`, `planning/architecture.md`, `planning/testing-strategy.md`, and `planning/development-workflow.md`.
3. Inspect the affected code and tests before editing.

## Canonical commands

```bash
npm test
npm run test:workerd
npm run test:browser
npm run validate
npm run dev
```

Node 22.16.0 is pinned in `.nvmrc`. Cloudflare Workers and browser-development dependencies are exactly pinned and must remain represented by a committed `package-lock.json`. Do not introduce or update dependencies without a concrete need, provenance review, and lockfile update.

Playwright browser acceptance requires a compatible Chromium installation. Use `npx playwright install chromium` for local browser work. Canonical GitHub validation installs Chromium explicitly before running `npm run validate`.

## Canonical identity model

- Scribbles GameFrame is the game platform, package, service, and deployment.
- Scribbles Runtime is the peer runtime that hosts agent capabilities and model access.
- Theo is the public-facing agent, user-visible opponent, and registered GameFrame player with stable player ID `theo`.
- Use the current Scribbles platform and runtime names consistently while preserving Theo as the agent identity.

## Architectural boundaries

- `src/platform` owns transport-neutral game and match contracts.
- `src/games/*` owns game-specific state, rules, observations, and legal actions.
- `src/agents` owns nonhuman decision contracts. Theo is a participant through an adapter, not the authority for game mechanics.
- `src/server` owns the current authoritative process boundary. Browser clients never mutate state directly.
- Discord, Cloudflare, and Scribbles Runtime integrations must enter through explicit adapters. Do not scatter vendor SDK calls through game logic.
- Event history, revision checks, idempotency, and visibility are correctness requirements, not deployment polish.
- HTTP owns commands; WebSockets are projection-only. Do not introduce a second mutation path without preserving the same validation and idempotency contracts.

## Public repository controls

- The source is publicly viewable but remains proprietary and all rights reserved. Do not add an open-source license without an explicit ownership decision.
- Never commit credentials, tokens, cookies, private keys, production user data, private campaign data, incident records, or secret-bearing environment files.
- Production secrets belong in GitHub, Cloudflare, or equivalent secret stores and must enter only through deployment bindings.
- Treat workflow logs, artifacts, screenshots, traces, branch history, pull requests, and commit history as public information.
- Public-repository workflows must use GitHub-hosted runners. Do not execute public repository code on persistent self-hosted runners.
- External code contributions are not accepted unless explicitly invited and covered by an approved contributor-rights agreement.
- Third-party code, assets, and data require documented provenance, license compatibility, attribution, and an explicit repository boundary before inclusion.

## Current active lane

`GF-0006`: implement American Checkers as the first nontrivial reusable game-module proof. Use an 8x8 board and explicitly test dark-square movement, mandatory captures, multi-jump continuation, promotion, king movement and captures, win conditions, draw or no-progress policy, replay, observations, deterministic opponents, and compatibility with the versioned mock-agent contract.

`GF-0005` is canonically complete. The version-1 decision protocol and fixtures in `planning/agent-decision-protocol.md` and `test/fixtures/agent-decision/` are the compatibility boundary for future Runtime work.

`GF-0004` standalone Cloudflare and Discord canaries are paused until the repository owner is available for deployment setup. They remain unresolved external checkpoints and must not be claimed from repository validation. See `planning/decisions/0009-defer-external-canaries-without-blocking-development.md`.

## Development and validation posture

- Develop every feature on a dedicated branch and keep its pull request in draft while implementation is active.
- Run targeted tests while iterating and run the complete `npm run validate` suite before pushing any branch head represented as locally verified.
- Record the exact validated commit SHA and execution environment in the pull request. A local statement is evidence of development verification, not canonical CI.
- Ordinary branch pushes and pull-request updates must not start GitHub Actions. GitHub-hosted validation is reserved for completed feature candidates and major milestones.
- When a feature is complete, update it from `main`, run the complete suite locally again, push the final head, and freeze the branch.
- Start `Canonical Validation` either by manual workflow dispatch or by applying the `canonical-validation` label to the frozen pull request. Merge only after its `validate` job passes, and rerun it if the branch changes afterward.
- Real Discord, deployed Cloudflare, and Scribbles Runtime behavior require compact external canaries and must not be claimed from local tests or the repository-only canonical suite.