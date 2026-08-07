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

This is not yet the final durable production binding.

## Active

### GF-0011B — Durable Monster Master RPG encounter productionization

Port the merged Node-local encounter-to-match semantics onto GameFrame's existing durable RPG and encounter authority.

Required work:

- durable encounter-to-match binding across process restart;
- preserve RPG campaign participant/team/controller identity into match authority;
- preserve stable mapping between RPG encounter participants and authoritative match units;
- durable SQLite-backed RPG service wiring;
- deployed service-to-service authorization and retry/reconnect behavior;
- exact structured terminal participant outcomes for runtime aftermath;
- deployed Cloudflare edge and Durable Object match authority where the selected deployment profile requires them;
- operational reconciliation for partial distributed failures.

Do not create a parallel persistent encounter database merely to port the Node-local coordinator. Reuse the established durable RPG/encounter stores.

### Monster Master RPG rules fidelity

The RPG campaign package can describe trainer/species/rules/ability choices beyond the fixed MM-0001 duel templates. The first playable campaign must not advertise combat options that Arena silently replaces with unrelated fixed units.

Near-term rule:

- either narrow the first package's combat-relevant selectable surface to what GameFrame executes;
- or add an explicit RPG encounter definition/configuration that instantiates units from the supplied participant rules state.

Reuse tactical primitives, rendering, match authority, and BattleBot infrastructure without forcing the fixed `monster-master-duel` roster to become every future RPG battle ruleset.

### Team-aware RPG battles

The initial adapter intentionally rejects cooperative campaign rosters because the existing Arena battle is a two-seat duel. Multiplayer design must explicitly map:

```text
human player ID
→ campaign participant
→ team
→ controlled trainer or units
→ permitted actions
```

Enemy control remains separately represented. Do not place a second cooperative human on the opposing seat merely to satisfy the duel contract.

This work follows the first complete single-player campaign proof unless a concrete blocker requires an earlier interface decision.

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
