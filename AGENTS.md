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

The Node-local encounter adapter supports cooperative campaign players on one allied team. Each human remains independently authenticated while the adapter maps authorized teammates to one synthetic allied tactical seat at the match-authority boundary. Returned projections alias that tactical seat back to the requesting human. Normal GameFrame revision and legality checks arbitrate teammate actions; Monster Master BattleBot remains the separately represented opposition.

The VM-first durable RPG path persists the encounter-to-match binding, synthetic team seat, authorized player identities, exact configured participant/unit mappings, and Monster Master match snapshot in the same SQLite database as GameFrame's durable campaign and encounter authority. Public `rpg:*` match view/action requests remain authenticated at the Cloudflare Worker and are HMAC-proxied to the VM authority; ordinary GameFrame matches continue to use Durable Objects.

This is **shared-team action authority**, not exclusive per-player action ownership. The durable binding retains mapping mode `shared-team-roster` because any authorized teammate may submit a legal allied action, while `participantUnitIds` now records the exact campaign participant→tactical creature assignment and `assignedUnitIds` exposes that assignment to the requesting player. Do not place cooperative humans on opposing duel seats merely to satisfy MM-0001's two-seat contract.

For `monster-master-rpg`, GameFrame materializes the existing encounter `rulesState.creatureIds` into the authoritative revision-zero Arena state. Trainers remain encounter participants/controllers; they are not silently replaced by the standalone Warden Master tactical unit. The current executable species surface is intentionally narrow: Emberling and Bulwark creature profiles already implemented by Arena. Unsupported species, extra combat rules, custom battlefield layouts, unsupported objectives/difficulty values, and asymmetric tactical roster sizes fail closed before durable encounter custody rather than being substituted or ignored.

Terminal RPG participant results are derived from the exact persisted participant→creature mapping and terminal authoritative creature health/defeat state. If a mapped creature cannot be reconciled with terminal match state, completion fails closed.

## Current active lane

Durable encounter→match restart/reconnect authority, shared-team tactical control, and participant-faithful configured Monster Master creature materialization are established repository substrates. The next product-critical gate is the complete full-stack Monster Master campaign proof with the real CampaignPackage and Dungeon Master path. Broader species/rules support should be added only when an actual package requires it; asymmetric deployment requires an explicit Monster Master rules change rather than a configuration workaround. Runtime campaign join/party lifecycle and official two-human campaign acceptance remain separate gates even though the tactical shared-team substrate already exists.

## Public repository controls

- The source is publicly viewable but proprietary and all rights are reserved.
- Never commit credentials, tokens, cookies, private keys, production user data, private campaign data, incident records, or secret-bearing environment files.
- Production secrets belong in GitHub, Cloudflare, or equivalent secret stores.
- Treat workflow logs, artifacts, screenshots, traces, branches, pull requests, and commit history as public information.
- Public-repository workflows must use GitHub-hosted runners. Do not execute public repository code on persistent self-hosted runners.
- Third-party code, assets, and data require documented provenance, compatible licensing, and attribution.
- Cascade historical testing evidence is stored in the private `QuankAIWS/rpg-gm-runtime` repository under `archive/cascade-testing/`; GameFrame remains the owner of that evidence even though the private repository is the storage location.
- GitHub Actions artifacts are transient, not the historical record. Meaningful Cascade bot baselines, calibration profiles, fragility reports, and human-playtest snapshots must be copied to the private archive with the GameFrame commit and workflow/run provenance before transient artifacts expire.
- Raw Cascade player telemetry, stable player IDs, session IDs, and other private player-level records must stay in private storage. Public GameFrame may retain aggregate or anonymized analysis only.

## Cascade level-generation authority

- For Cascade campaign expansion, read `planning/cascade-10000-campaign-roadmap.md`, `planning/cascade-cognitive-health-and-engagement.md`, and `planning/cascade-testing-methodology.md` before inferring generation cadence, cognitive design, or difficulty policy.
- Before broad new Cascade cognitive-health or competitive-match-3 research, read and extend `planning/research/cascade-cognitive-health-research.md` and `planning/research/cascade-match3-engagement-research.md`; do not discard the retained evidence base and start from zero unless freshness or a new research question requires it.
- The current production expansion unit is **150 levels per generation/tuning pass**. The 451–600 accepted expansion is the reference workflow.
- Cascade PR bot validation is change-aware: fast contracts/UI stay scoped to affected surfaces; balance-semantic changes get a deterministic campaign canary; generated level-definition changes get a deep profile and fragility scan only across the changed range plus a 30-level seam.
- Exhaustive whole-campaign bot profiling is not a routine PR merge gate. `.github/workflows/cascade-nightly.yml` owns the sharded nightly full-campaign regression after recent balance-relevant work, with manual dispatch for major checkpoints. Broad actual rebalances may still justify an expensive changed-range PR profile.
- Routine nightly artifacts are transient. Promote accepted milestones, meaningful regressions, and persona-calibration checkpoints to the canonical private Cascade testing archive rather than archiving every nightly run.
- `CHAPTER_SIZE = 30`, 30-level map windows, and 30-level chapter recipes are internal organization/presentation structures only. They do **not** mean agents should generate or tune only 30 levels at a time.
- `planning/cascade-cognitive-design-and-playtesting.md` is historical product-design material and is not authoritative for current bot architecture, level counts, generation cadence, difficulty calibration, or implementation order.
- Do not revive superseded prototype-era or chapter-sized production guidance from repository history unless the user explicitly asks for historical context.
- Memory/hidden-information mechanics must preserve the observation boundary: human-like bots may use only information actually revealed to the player; hidden engine truth is reserved for explicitly labeled oracle/solvability agents.
- Do not present Cascade as medical treatment, dementia prevention, diagnosis, or proof of cognitive improvement. The product goal is fun-first cognitive stimulation for older family players.

## Cascade public-safe difficulty mirror

- `data/cascade/difficulty-archive/` is the public-safe compact mirror used for repository-local comparisons and CI integrity checks; it is **not** the canonical historical store.
- The canonical long-term Cascade evidence archive remains the private `QuankAIWS/rpg-gm-runtime/archive/cascade-testing/` store.
- Accepted bot-profile/fragility snapshots may be committed to the public mirror when they contain no private player data. Meaningful accepted evidence must also be retained in the private canonical archive with exact GameFrame commit and workflow provenance.
- Sanitized anonymous player aggregates may live in the public mirror only when identities, session/attempt/event IDs, device metadata, and raw event streams are absent. The private raw source, when available, stays in the canonical private archive.
- Never overwrite historical snapshots. Mark candidate evidence as candidate until the corresponding code is accepted.
- Run `npm run cascade:archive:check` after public-mirror edits. Use `npm run cascade:archive -- --profile=... --out=...` to compact generated profiles.

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