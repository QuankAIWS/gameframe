# AGENTS.md — Scribbles GameFrame

Scribbles GameFrame is the publicly viewable, proprietary game platform used by Theo and the wider Scribbles architecture. It is not a generalized public game engine, plugin marketplace, or production SaaS platform. The immediate gameplay objective is to validate, review, and merge the first playable Monster Master duel built on the deterministic multiplayer, tactical combat, browser, Workers-runtime, agent, Discord identity, and authenticated invitation contracts already proven in the repository.

## Startup

1. Read this file.
2. Read `planning/ROADMAP.md`, `planning/architecture.md`, `planning/testing-strategy.md`, `planning/development-workflow.md`, `planning/discord-authentication-and-cloudflare-canary.md`, `planning/authenticated-match-invitations.md`, `planning/tactical-battler-rpg-foundation.md`, `planning/monster-master-rules.md`, and `planning/browser-journey-matrix.md`.
3. For visual-production work, also read `planning/visual-asset-build-contract.md`, `planning/clockwork-eclipse-checkers-visual-pipeline.md`, and `planning/decisions/0010-clockwork-eclipse-checkers-presentation.md`.
4. Inspect the affected code and tests before editing.
5. For MM-0001 continuation, read `planning/validation/2026-07-30-monster-master-first-playable.md` and PR #39 before expanding scope.

## Canonical commands

```bash
npm test
npm run test:workerd
npm run check:activity
npm run check:browser
npm run test:browser
npm run test:visual
npm run test:visual-baseline
npm run validate
npm run dev
```

Node 22.16.0 is pinned in `.nvmrc`. Cloudflare Workers, Discord Activity, bundling, and browser-development dependencies are exactly pinned and must remain represented by a committed `package-lock.json`. Do not introduce or update dependencies without a concrete need, provenance review, lockfile update, and third-party notice when applicable.

Playwright browser acceptance requires a compatible Chromium installation. Use `npx playwright install chromium` for local browser work. Canonical GitHub validation installs Chromium explicitly before running `npm run validate`.

## Canonical identity model

- Scribbles GameFrame is the game platform, package, service, and deployment.
- Scribbles Runtime is the peer runtime that hosts agent capabilities and model access.
- Theo is the public-facing agent, user-visible opponent, and registered GameFrame player with stable player ID `theo`.
- Discord users receive stable GameFrame player IDs in the form `discord:<discord-user-id>`.
- Discord display names and avatars are presentation metadata, not authorization keys.
- Use the current Scribbles platform and runtime names consistently while preserving Theo as the agent identity.

## Architectural boundaries

- `src/platform` owns transport-neutral game and match contracts.
- `src/games/*` owns game-specific state, rules, observations, and legal actions.
- `src/agents` owns nonhuman decision contracts. Theo is a participant through an adapter, not the authority for game mechanics.
- `src/server` owns the current local authoritative process boundary. Browser clients never mutate state directly.
- Discord, Cloudflare, and Scribbles Runtime integrations must enter through explicit adapters. Do not scatter vendor SDK calls through game logic.
- Discord authenticates external users; GameFrame issues its own signed session and remains the authority for seats, commands, and match state.
- Hosted human-versus-human seats require signed, expiring invitation claims by independently authenticated principals. Never restore URL player impersonation or caller-supplied Discord seats.
- Event history, revision checks, idempotency, and visibility are correctness requirements, not deployment polish.
- HTTP owns commands; WebSockets are projection-only. Do not introduce a second mutation path without preserving the same validation and idempotency contracts.
- Tactical renderers consume authoritative map, unit, action, effect, and visibility state. Camera position, interpolation, hover previews, and transient animation remain presentation state.
- Monster Master, future RPG encounters, and D&D-style encounters may share map, encounter, replay, service, storage, projection, identity, invitation, and rendering infrastructure without sharing one `GameDefinition`, turn economy, or rules implementation.

## Public repository controls

- The source is publicly viewable but remains proprietary and all rights reserved. Do not add an open-source license without an explicit ownership decision.
- Never commit credentials, tokens, cookies, private keys, production user data, private campaign data, incident records, or secret-bearing environment files.
- Production secrets belong in GitHub, Cloudflare, or equivalent secret stores and must enter only through deployment bindings.
- Treat workflow logs, artifacts, screenshots, traces, branch history, pull requests, and commit history as public information.
- Public-repository workflows must use GitHub-hosted runners. Do not execute public repository code on persistent self-hosted runners.
- External code contributions are not accepted unless explicitly invited and covered by an approved contributor-rights agreement.
- Third-party code, assets, and data require documented provenance, license compatibility, attribution, and an explicit repository boundary before inclusion.

## Current active lane

`GF-0010 / MM-0001`: review and freeze the repository-complete first playable Monster Master candidate on PR #39.

The candidate now includes:

- separate `monster-master-duel` rules and service boundaries
- one Warden Master, Stone Bulwark, and Emberling per player
- alternating deployment zones and complete deployment-to-combat progression
- stable content IDs and deterministic initiative
- movement, line of sight, attacks, health, defeat, Master victory, and bounded draw
- command energy, round regeneration, and Warden `Mend`
- deterministic Theo and complete self-play
- local and Durable Object persistence, replay, resume, and player-specific projections
- signed hosted invitation integration and local two-browser play
- dedicated Canvas UI, camera controls, mobile deployment, recovery handling, and curated visual evidence

The immediate remaining gates are:

- exact-head canonical validation after documentation and visual-review corrections
- final curated artifact inspection with globally unique evidence names
- owner-controlled local gameplay and subjective presentation review
- merge after the exact validated head is unchanged
- deployed Cloudflare and real Discord website/Activity canaries when the owner is available

Do not turn MM-0001 into the open world, campaign layer, full content roster, randomized loot system, generated-story system, or D&D rules engine. Preserve those directions through explicit encounter configuration, content definitions, and separate game or campaign wrappers.

`TC-0001` map/movement/Canvas and `TC-0002` deterministic combat are complete repository proofs. `GF-0004` website OAuth, Discord Activity client authentication, signed GameFrame sessions, and authenticated human invitations are repository-complete. Live Cloudflare deployment and real Discord desktop/mobile canaries remain owner-controlled external checkpoints and must not be claimed from repository validation.

## Clockwork Eclipse visual continuation

The dedicated visual-production branch is based on PR #39 head `7e079bdfc6d847661e18e147522a459d6998e5a4`. Its first documentation slice selects Clockwork Eclipse as the American Checkers theme and defines the reusable asset-build contract.

Visual implementation must preserve the existing authoritative Checkers rules, legal actions, identity, HTTP commands, projections, invitations, resume behavior, and stable selectors. The intended active-match shell uses `100dvh`, disables document-level gameplay scrolling, keeps the board dominant, and converts secondary information to bounded drawers or overlays at narrow widths.

Generated imagery is source material, not a production asset. Production work must proceed through approved lossless masters, a committed manifest, deterministic derivatives, automated image checks, reproducibility verification, browser journeys, curated screenshots, and direct screenshot inspection.

The intended future command surface is:

```bash
npm run assets:check
npm run assets:build
npm run assets:verify
```

Do not add these commands as no-op placeholders. Implement them only with real source masters, deterministic transforms, pinned tooling, and meaningful failure behavior. Image generation must remain outside canonical CI.

## Development and validation posture

- Develop every feature on a dedicated branch and keep its pull request in draft while implementation or review is active.
- Run targeted tests while iterating and run the complete `npm run validate` suite before pushing any branch head represented as locally verified.
- Record the exact validated commit SHA and execution environment in the pull request. A local statement is evidence of development verification, not canonical CI.
- Ordinary branch pushes and pull-request updates must not start GitHub Actions. GitHub-hosted validation is reserved for completed feature candidates and major milestones.
- When a feature is complete, update it from `main`, run the complete suite locally again, push the final head, and freeze the branch.
- Start `Canonical Validation` either by manual workflow dispatch or by applying the `canonical-validation` label to the frozen pull request. Merge only after its `validate` job passes, and rerun it if the branch changes afterward.
- Use the separate `visual-review` label when a curated screenshot artifact is required. Inspect the actual artifact; a successful capture job is not itself visual approval.
- Real Discord, deployed Cloudflare, and Scribbles Runtime behavior require compact external canaries and must not be claimed from local tests or the repository-only canonical suite.
