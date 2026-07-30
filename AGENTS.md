# AGENTS.md — Scribbles GameFrame

Scribbles GameFrame is the publicly viewable, proprietary game platform used by Theo and the wider Scribbles architecture. It is not a generalized public game engine, plugin marketplace, or production SaaS platform. The immediate objective is the first playable Monster Master duel, built on the deterministic multiplayer, tactical combat, browser, Workers-runtime, and agent contracts already validated in the repository.

## Startup

1. Read this file.
2. Read `planning/ROADMAP.md`, `planning/architecture.md`, `planning/testing-strategy.md`, `planning/development-workflow.md`, and `planning/tactical-battler-rpg-foundation.md`.
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
- Tactical renderers consume authoritative map, unit, action, effect, and visibility state. Camera position, interpolation, hover previews, and transient animation remain presentation state.
- Monster Master, future RPG encounters, and D&D-style encounters may share map, encounter, replay, service, storage, projection, and rendering infrastructure without sharing one `GameDefinition`, turn economy, or rules implementation.

## Public repository controls

- The source is publicly viewable but remains proprietary and all rights reserved. Do not add an open-source license without an explicit ownership decision.
- Never commit credentials, tokens, cookies, private keys, production user data, private campaign data, incident records, or secret-bearing environment files.
- Production secrets belong in GitHub, Cloudflare, or equivalent secret stores and must enter only through deployment bindings.
- Treat workflow logs, artifacts, screenshots, traces, branch history, pull requests, and commit history as public information.
- Public-repository workflows must use GitHub-hosted runners. Do not execute public repository code on persistent self-hosted runners.
- External code contributions are not accepted unless explicitly invited and covered by an approved contributor-rights agreement.
- Third-party code, assets, and data require documented provenance, license compatibility, attribution, and an explicit repository boundary before inclusion.

## Current active lane

`GF-0010 / MM-0001`: build the first playable two-player Monster Master duel as a separate game definition over the validated tactical substrate.

The first slice should include:

- one Master and a small roster of monsters for each player
- explicit deployment zones and a bounded deployment phase
- stable unit archetypes and content IDs
- a small resource model used by deployment or abilities
- movement, line of sight, attacks, health, defeat, effects, and victory through authoritative actions
- at least one simple ability that proves actions are not limited to generic attacks
- a complete beginning-to-end duel against deterministic Theo and another human seat
- a dedicated browser surface with functional silhouettes and UI rather than final art
- replay, resume, Workers eviction recovery, and player-specific legal-action projections

Do not turn MM-0001 into the open world, campaign layer, full content roster, randomized loot system, generated-story system, or D&D rules engine. Preserve those directions through explicit encounter configuration, content definitions, and separate game or campaign wrappers.

`TC-0001` map/movement/Canvas and `TC-0002` deterministic combat are complete repository proofs. `GF-0004` standalone Cloudflare and Discord canaries remain paused until the repository owner is available for deployment setup. They remain unresolved external checkpoints and must not be claimed from repository validation.

## Development and validation posture

- Develop every feature on a dedicated branch and keep its pull request in draft while implementation is active.
- Run targeted tests while iterating and run the complete `npm run validate` suite before pushing any branch head represented as locally verified.
- Record the exact validated commit SHA and execution environment in the pull request. A local statement is evidence of development verification, not canonical CI.
- Ordinary branch pushes and pull-request updates must not start GitHub Actions. GitHub-hosted validation is reserved for completed feature candidates and major milestones.
- When a feature is complete, update it from `main`, run the complete suite locally again, push the final head, and freeze the branch.
- Start `Canonical Validation` either by manual workflow dispatch or by applying the `canonical-validation` label to the frozen pull request. Merge only after its `validate` job passes, and rerun it if the branch changes afterward.
- Real Discord, deployed Cloudflare, and Scribbles Runtime behavior require compact external canaries and must not be claimed from local tests or the repository-only canonical suite.
