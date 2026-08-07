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
- Theo may later join through an explicit External Theo player connector as an ordinary player. Theo is not a built-in opponent, deterministic fallback, or Dungeon Master.

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

PR #124 established the first player-facing campaign-to-battle semantic/UI proof:

```text
Dungeon Master encounter scene
→ GameFrame creates one bound Monster Master battle
→ campaign shell opens Arena Battles
→ battle completes
→ GameFrame commits structured terminal outcome
→ RPG GM continuation publishes aftermath
→ player returns to campaign shell
```

That initial proof used one authenticated human against Monster Master BattleBot. PR #152 then extended the Node-local adapter with explicit shared-team cooperative control:

- multiple authenticated campaign players may belong to one allied RPG team;
- each human retains their own GameFrame principal at ingress;
- authorized teammates map to one synthetic allied tactical seat only at the match-authority boundary;
- returned projections alias the synthetic seat back to the requesting player;
- normal GameFrame revision and legality checks arbitrate teammate actions;
- outsiders and Monster Master BattleBot cannot act through the allied binding;
- terminal tactical winners map back to RPG team outcomes;
- cooperative humans are never placed on opposing duel seats merely to satisfy MM-0001's two-seat engine.

This is shared-team control, not exclusive per-player unit ownership. The Node-local binding remains an in-memory semantic adapter and still materializes the fixed `monster-master-duel` roster rather than a participant-faithful campaign-configured roster.

## Active

### GF-0011B — Durable Monster Master RPG encounter productionization

The VM-first repository implementation now ports the shared-team encounter-to-match semantics onto GameFrame's existing durable RPG authority without creating a second encounter database.

Repository implementation:

- campaign and encounter custody remain in the established SQLite RPG database;
- RPG-bound Monster Master match snapshots are persisted in that same database through the ordinary `MatchSession` snapshot contract;
- the encounter↔match binding survives process restart;
- authenticated player IDs, RPG team IDs, the synthetic tactical team seat, and shared-team roster mapping survive restart;
- a process death after match creation but before binding materialization is reconciled from durable encounter launch custody;
- same-match VM actions are serialized before load/apply/save, preserving revision authority in the selected single-owner deployment profile;
- terminal encounter completion derives its timestamp from the persisted terminal match event so exact completion retry remains stable after restart;
- the durable VM HTTP service exposes only RPG-bound `rpg:*` match view/action authority in addition to its RPG campaign/encounter routes;
- the Cloudflare Worker authenticates those public requests and HMAC-proxies them to the VM RPG service;
- ordinary GameFrame matches remain on the existing Durable Object path;
- RPG battle pages use HTTP polling so projection traffic cannot accidentally reconnect to the ordinary Durable Object match store.

The persisted mapping mode is `shared-team-roster`. It preserves stable team/participant correlation with the authoritative roster but does not claim exclusive player→unit ownership.

Repository-level restart and transport tests are not a deployed production claim. VM/Cloudflare/Discord canaries, backup/restore evidence, and operational reconciliation remain required before production-readiness language is justified.

### Monster Master RPG rules fidelity

The remaining tactical correctness gap is participant-faithful encounter materialization. The current durable adapter still creates the fixed MM-0001 `monster-master-duel` roster. A CampaignPackage may describe trainer, species, rules, ability, resource, or status choices that this fixed roster does not execute.

Near-term rule:

- either narrow the first package's combat-relevant selectable surface to what GameFrame actually executes;
- or add a validated RPG encounter configuration/state materializer that instantiates authoritative tactical units from supported participant rules state.

If the package exposes a combat-relevant mechanic that the selected Arena rules definition cannot execute truthfully, encounter launch must fail closed. Do not silently replace campaign participant configuration with unrelated fixed units.

A preferred implementation shape is:

```text
validated RPG encounter request
→ durable RPG encounter authority
→ validated Monster Master encounter configuration
→ authoritative revision-zero Monster Master initial state
→ ordinary MatchSession / replay / legal-action authority
→ exact participant-to-unit terminal outcome
```

`MatchSession` already persists and replays an explicit initial state. Use that capability rather than inventing a second tactical event model.

### Single-player full-stack campaign proof

The next full-product engineering gate remains one complete campaign path with one authenticated human plus Monster Master BattleBot. Tactical shared-team capability existing early does not remove the need to prove the simpler complete architecture first.

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

This proves the complete package → Dungeon Master → GameFrame → Arena → aftermath architecture. It does not by itself prove party-private multiplayer campaign behavior.

### Team-aware RPG battles

Team-aware tactical control is now an established GameFrame substrate in both the Node-local adapter and the VM-first durable binding:

```text
authenticated human player
→ campaign participant
→ allied RPG team
→ persisted synthetic GameFrame tactical team seat
→ legal Monster Master actions
```

Current semantics:

- cooperative human players remain separate authenticated GameFrame principals;
- multiple players may share one allied RPG team without occupying opposing duel seats;
- encounter participant identity remains stable in durable binding metadata;
- authorized teammates share the allied tactical roster under mapping mode `shared-team-roster`;
- normal revision checks arbitrate concurrent teammate submissions;
- Monster Master BattleBot remains separately represented opposition;
- outsiders and the bot cannot act through allied human bindings;
- restart and reconnect preserve the team seat and authoritative roster mapping.

Not yet claimed:

- exclusive per-player unit ownership;
- participant-specific configured tactical units derived from arbitrary CampaignPackage rules state;
- full runtime campaign join/party lifecycle;
- official two-human campaign acceptance.

### Two-human campaign acceptance

After the real CampaignPackage/Dungeon Master full-stack proof and runtime join/party lifecycle are in place, prove the official two-human journey using the existing team-aware tactical substrate:

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