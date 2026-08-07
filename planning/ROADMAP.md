---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - Monster Master Arena Battles
  - RPG GameFrame integration
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-roadmap.md
  - rpg-gameframe-interface-contract.md
  - monster-master-rpg-canonical-baseline.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- GameFrame is the authoritative game platform.
- Built-in deterministic opponents use player ID `gameframe-bot` and game-specific bot presentation.
- `rpg-gm-runtime` owns the Dungeon Master and campaign authority.
- Scribbles Runtime is a separate future integration host for Theo.
- Theo may later join through an explicit connector as an ordinary player. Theo is not a built-in opponent, deterministic fallback, or Dungeon Master.

See `planning/decisions/0005-gameframe-bot-and-external-agent-boundary.md`.

## Completed platform proofs

### GF-0001 — Authoritative Tic-Tac-Toe walking skeleton

- Server-authoritative two-seat matches
- Authenticated player actions
- Revision, idempotency, replay, and snapshot contracts
- Human-versus-human and human-versus-CPU-Opponent flows
- Perfect deterministic GameFrameBot policy

### GF-0002 — Cloudflare-compatible match runtime

- Storage-neutral asynchronous services
- Durable Object storage and serialized authority
- Worker routing and WebSocket projections
- Identity verification and fail-closed public API behavior
- Workers-runtime persistence, eviction, and competing-write coverage

### GF-0003 — Browser delivery proof

- Match create, share, play, complete, resume, refresh, reconnect, and invalid-resume behavior
- Responsive desktop and mobile browser paths
- HTTP polling fallback
- Playwright acceptance and curated visual review

### GF-0004 — Discord identity and authenticated invitations

- Website OAuth and Discord user verification
- Activity SDK authorization and signed sessions
- Stable `discord:<user-id>` GameFrame principals
- Signed expiring second-seat invitations
- Hosted identity spoofing rejection

Live deployed Cloudflare and Discord canaries remain separate from repository proof.

### GF-0005 — Versioned decision-provider contract

- Structured request and response schemas
- Game, match, player, revision, deadline, observation, and legal-action context
- Correlation, identity, revision, legality, duplicate, timeout, and malformed-response validation
- Deterministic and adversarial mock providers

This protocol is generic. It may later support named external agents, including Theo, without making those agents the built-in GameFrameBot.

### GF-0006 / GF-0007 — American Checkers

- Complete deterministic American Checkers rules
- Mandatory captures, multi-jumps, promotion, kings, blockade wins, and bounded draws
- Human-versus-human and human-versus-CheckersBot services and browser play
- Durable Object recovery and provider-compatible decision flow

### TC-0001 — Tactical movement foundation

- Semantic 24×24 map
- Weighted movement and occupancy
- Replay and snapshots
- Canvas camera, pan, zoom, selection, and legal-path previews

### TC-0002 — Tactical combat foundation

- Initiative and bounded activations
- Movement, line of sight, attacks, health, defeat, effects, victory, and draws
- Human-versus-human and human-versus-ArenaBot flows
- Node, browser, and Workers-runtime paths

### MM-0001 — Monster Master Arena Battles foundation

- Separate `monster-master-duel` rules
- Three-unit trainer teams and deployment
- Deterministic initiative, movement, attacks, health, Master victory, and draws
- Command energy and Warden Master `Mend`
- Human-versus-human and human-versus-Monster-Master-BattleBot flows
- Replay, persistence, invitations, browser play, Pixi/Canvas rendering, and visual review

### GF-0011A — Node-local Monster Master RPG encounter loop

Merged through PR #124 as the first player-facing campaign-to-battle semantic/UI proof:

```text
Dungeon Master encounter scene
→ GameFrame creates one bound Monster Master battle
→ campaign shell opens Arena Battles
→ battle completes
→ GameFrame commits structured terminal outcome
→ RPG GM continuation publishes aftermath
→ player returns to campaign shell
```

The merged baseline proves:

- Node-local campaign shell;
- deterministic encounter-to-match binding;
- exactly one human campaign player against Monster Master BattleBot;
- authorized battle handoff;
- narrative input fenced while battle is active;
- terminal result committed back to the RPG service;
- return-to-campaign presentation;
- BattleBot remains a built-in GameFrame participant, not Theo or the Dungeon Master.

The current coordinator deliberately rejects encounters containing more than one human player. It also creates the ordinary fixed `monster-master-duel` from the human GameFrame player ID plus `gameframe-bot`; it does not yet materialize the RPG participant roster into authoritative tactical units. Terminal RPG participant results in this slice are therefore semantic/team-level proof rather than participant-faithful tactical aftermath.

This is not the final durable production binding.

## Active

### GF-0011B — Durable Monster Master RPG encounter productionization

Port the merged Node-local encounter-to-match semantics onto GameFrame's existing durable RPG and encounter authority.

GameFrame already has durable campaign and encounter SQLite authority. The missing production slice is the binding between that durable encounter record and an authoritative Monster Master match; do not rebuild encounter persistence merely to create the battle.

Required work:

- durable encounter-to-match binding across process restart;
- preserve RPG campaign participant/team/controller identity into match authority;
- preserve a stable mapping between RPG encounter participants and authoritative match units;
- preserve supplied rules-state data that the selected encounter ruleset actually supports;
- durable SQLite-backed RPG service wiring;
- deployed service-to-service authorization and retry/reconnect behavior;
- exact structured terminal participant outcomes for runtime aftermath;
- deployed Cloudflare edge and Durable Object match authority where the selected deployment profile requires them;
- operational reconciliation for partial distributed failures.

Do not create a parallel persistent encounter database merely to port the Node-local coordinator. Reuse the established durable RPG/encounter stores.

A preferred implementation shape is:

```text
validated RPG encounter request
→ durable RPG encounter authority
→ validated Monster Master encounter configuration
→ authoritative revision-zero Monster Master initial state
→ ordinary MatchSession / replay / legal-action authority
→ exact participant-to-unit terminal outcome
```

`MatchSession` already persists and replays an explicit initial state. The RPG slice should use that capability rather than inventing a second tactical event model.

### Monster Master RPG rules fidelity

The RPG campaign package can describe trainer/species/rules/ability choices beyond the fixed MM-0001 duel templates. The first playable campaign must not advertise combat options that Arena silently replaces with unrelated fixed units.

Near-term rule:

- either narrow the first package's combat-relevant selectable surface to what GameFrame executes;
- or add an explicit RPG encounter definition/configuration that instantiates units from the supplied participant rules state.

Reuse tactical primitives, rendering, match authority, and BattleBot infrastructure without forcing the fixed `monster-master-duel` roster to become every future RPG battle ruleset.

A configured initial state is not permission to accept unsupported mechanics. If the package exposes a trainer rules profile, monster species, ability, resource, or status as combat-relevant, the selected Arena rules definition must implement it or fail closed.

### Single-player full-stack campaign proof

Before multiplayer Arena control is added, prove one complete campaign path with one authenticated human and Monster Master BattleBot:

```text
real CampaignPackage
→ real Dungeon Master provider
→ durable GameFrame campaign command/result linkage
→ participant-faithful Arena launch
→ actual Monster Master match
→ exact terminal participant outcomes
→ automatic Dungeon Master aftermath
→ bounded campaign resolution
→ GameFrame + runtime restart/resume
```

This is the first full-stack engineering proof. It does not claim multiplayer behavior.

## Planned after the single-player vertical slice

### Team-aware RPG battles

The current Node-local adapter does **not** implement cooperative control; it fails closed when more than one human player appears in the encounter roster.

The planned cooperative control model is:

```text
authenticated human player
→ campaign participant
→ allied RPG team
→ controlled trainer/monster units
→ legal Monster Master actions
```

Required semantics:

- cooperative human players remain separate authenticated GameFrame principals;
- multiple players may belong to the same RPG team without being placed on opposing duel seats;
- encounter participant identity remains stable through the tactical match;
- authorization identifies which participant/unit actions each player may submit;
- normal GameFrame revision checks arbitrate concurrent teammate submissions;
- Monster Master BattleBot remains separately represented opposition;
- outsiders and the bot cannot act through allied human bindings;
- restart and reconnect preserve team and participant-unit mappings.

A temporary shared-team tactical seat may be considered as an adapter implementation technique, but it is not current behavior and must not erase authenticated player identity or campaign participant identity.

### Two-human campaign acceptance

After runtime join/party lifecycle and team-aware Arena control exist, prove the official two-human journey:

- two authenticated players join one campaign;
- public, party-private, and player-private information remains correctly scoped;
- both players submit freeform actions and structured choices;
- the party reaches and completes a real cooperative Arena encounter;
- exact participant outcomes return to the campaign;
- both services restart and both players resume without duplication or audience leakage.

## Future

### External Theo player connector

When Scribbles Runtime and Theo are ready, implement a separate connector that:

- authenticates as a dedicated external service;
- exposes only Theo's player-specific observation and current legal actions;
- submits actions only for an explicitly assigned Theo player seat;
- remains subject to the same revision, legality, timing, and authorization checks as every other player;
- has no Dungeon Master, hidden campaign, or GameFrame authority.

GameFrameBot remains the built-in deterministic participant. Theo does not replace it implicitly.

### Campaign and world expansion

After the encounter lifecycle and complete RPG vertical slice are proven:

- persistent party and inventory projections required by actual packages;
- exploration and points of interest;
- quests, dialogue, NPC, and campaign map presentation state;
- additional encounter rulesets;
- generated campaign packages and assets;
- richer resumable campaign views.

Campaign truth, Dungeon Master reasoning, and package authoring remain runtime responsibilities where appropriate. GameFrame retains authenticated player-facing projections and deterministic mechanics.

### Specialist game modules

- Chess with clocks, notation, Stockfish, strength profiles, and coaching
- Additional tactical and board-game modules
- Alternative Monster Master encounter themes without rewriting platform authority

## Deferred

- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
- Claims of production readiness before deployed canaries and recovery tests exist

## Documentation posture

RPG planning should have one index, one cross-repository roadmap, one GameFrame-local roadmap, and explicit specialist contracts rather than accumulating competing status memos.

Use:

- `planning/rpg-documentation-index.md` for RPG reading order;
- `planning/shared/rpg-platform-roadmap.md` for cross-repository milestone order;
- this file for GameFrame-local implementation direction;
- `planning/monster-master-rpg-canonical-baseline.md` for Monster Master authority.

RPG planning YAML metadata and local relationship links are validated by the focused documentation-hygiene check.

## Validation note

Validation is deliberate and exact-head. Completed GitHub Actions runs on the active pull request or durable validation records establish a tested commit; any later substantive commit requires a new pass before the corresponding product claim is advanced.