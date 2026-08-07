# AGENTS.md — Scribbles GameFrame

Scribbles GameFrame is the publicly viewable, proprietary game platform for authoritative multiplayer games, browser delivery, Discord delivery, and tactical encounters. It is independently usable and testable. It is not the Scribbles Runtime, it does not host Theo, and it does not host the Dungeon Master.

## Startup

1. Read this file.
2. Read `planning/ROADMAP.md`, `planning/architecture.md`, `planning/testing-strategy.md`, `planning/development-workflow.md`, `planning/decisions/0005-gameframe-bot-and-external-agent-boundary.md`, `planning/tactical-battler-rpg-foundation.md`, and `planning/monster-master-rules.md`.
3. For RPG work, read the GameFrame integration contract and treat `rpg-gm-runtime` as the Dungeon Master and campaign authority.
4. For visual work, read the visual asset and browser journey contracts before changing presentation.
5. Inspect affected code and tests before editing.

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

Node 22.16.0 is pinned in `.nvmrc`. Dependencies must remain exactly represented by the committed lockfile. Do not add or update dependencies without a concrete need, provenance review, lockfile update, and third-party notice when applicable.

## Canonical identity and authority model

- **Scribbles GameFrame** is the game platform, package, service, and deployment.
- **GameFrameBot** is the generic built-in deterministic opponent with stable player ID `gameframe-bot`.
- Game-specific presentation may call that participant **CPU Opponent**, **CheckersBot**, **ArenaBot**, or **Monster Master BattleBot**.
- Built-in bots are rules-based deterministic participants. Do not describe them as model-driven AI.
- **`rpg-gm-runtime`** owns the Dungeon Master, campaign narrative, encounter intent, and campaign continuation.
- **Scribbles Runtime** is a separate peer project that hosts Theo and other agent capabilities.
- **Theo** is a separate future external player. A future connector may submit legal actions on Theo's behalf only after Theo is explicitly assigned an ordinary GameFrame seat.
- Theo is never the built-in bot, deterministic fallback, Dungeon Master, default opponent, encounter authority, or game authority.
- Discord users receive stable GameFrame player IDs in the form `discord:<discord-user-id>`.
- Display names and avatars are presentation metadata, not authorization keys.

There is no compatibility requirement for the retired built-in `theo` seat. GameFrame has not been deployed with production match data. Remove incorrect identifiers rather than preserving aliases.

## Architectural boundaries

- `src/platform` owns transport-neutral game and match contracts.
- `src/games/*` owns game-specific state, rules, observations, legal actions, and deterministic bot policies.
- `src/agents` owns generic nonhuman decision contracts and the canonical GameFrameBot identity.
- `src/server` owns the current Node authoritative process boundary.
- `src/cloudflare` owns the Worker and Durable Object adapters.
- Browser clients, Discord clients, external agents, and the Dungeon Master never mutate authoritative state directly.
- Discord, Cloudflare, `rpg-gm-runtime`, and future Scribbles Runtime integration must enter through explicit adapters.
- GameFrame validates identity, revision, turn ownership, and legal actions before committing state.
- HTTP owns commands. WebSockets are projection-only.
- Tactical renderers consume authoritative state but own only camera, interpolation, hover, previews, and transient animation.
- Monster Master Arena Battles and Monster Master RPG may reuse platform infrastructure without collapsing tactical rules and campaign narration into one authority.

## RPG boundary

The required RPG path is:

```text
human players
→ rpg-gm-runtime Dungeon Master
→ structured encounter launch
→ GameFrame authoritative battle
→ structured terminal outcome
→ rpg-gm-runtime campaign continuation
```

The current Node-local encounter adapter supports exactly one human campaign player against Monster Master BattleBot. It fails closed when more than one human player appears in the encounter roster. It is an implementation-stage semantic/UI bridge, not the final durable participant-faithful RPG battle binding.

The planned cooperative model is player → campaign participant → allied RPG team → controlled trainer/monster units → legal action. Do not place cooperative humans on opposing duel seats merely to satisfy MM-0001's two-seat contract. A future shared-team or per-player control adapter must preserve each human's authenticated GameFrame identity and stable RPG participant/unit mapping across restart.

## Current active lane

The Node-local RPG adapter proves the one-human encounter-to-battle-to-campaign lifecycle. The next GameFrame RPG work is durable participant-faithful encounter→match productionization using the existing durable RPG/encounter authority, followed by the complete single-player campaign proof. Runtime join/party lifecycle and team-aware cooperative Arena control come after that vertical slice.

## Public repository controls

- The source is publicly viewable but proprietary and all rights are reserved.
- Never commit credentials, tokens, cookies, private keys, production user data, private campaign data, incident records, or secret-bearing environment files.
- Production secrets belong in GitHub, Cloudflare, or equivalent secret stores.
- Treat workflow logs, artifacts, screenshots, traces, branches, pull requests, and commit history as public information.
- Public-repository workflows must use GitHub-hosted runners. Do not execute public repository code on persistent self-hosted runners.
- Third-party code, assets, and data require documented provenance, compatible licensing, and attribution.

## Development and validation posture

- Develop consequential work on a dedicated branch.
- Run targeted tests while iterating and the complete validation suite before representing a head as verified.
- Record the exact validated commit and environment.
- Ordinary branch pushes should not start expensive validation.
- Canonical validation is deliberate and exact-head.
- Any commit after a canonical pass invalidates that pass.
- Use the separate visual-review lane when screenshots are required; a successful capture is not visual approval.
- Do not claim GitHub Actions, Cloudflare, Discord, Scribbles Runtime, or deployed behavior that was not actually exercised.

## Regression rule

Active code, tests, fixtures, browser selectors, and built-in opponent copy must not use Theo as a deterministic participant. Legitimate Theo references are limited to documents that explicitly describe the future external Scribbles Runtime connector.