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

## Active

### GF-0011 — Monster Master RPG encounter loop

Connect the separate Dungeon Master runtime to GameFrame through a structured encounter contract:

```text
human player action
→ rpg-gm-runtime Dungeon Master
→ committed encounter launch
→ GameFrame Arena battle
→ structured terminal outcome
→ rpg-gm-runtime continuation
```

Current branch scope:

- Node-local campaign shell
- deterministic encounter-to-match binding
- exactly one human campaign player against Monster Master BattleBot
- authorized battle handoff
- narrative input fenced while battle is active
- terminal result committed back to the RPG service
- return to campaign continuation

The BattleBot is a temporary deterministic enemy participant. It is not Theo and it is not the Dungeon Master.

Remaining productionization:

- durable encounter-to-match bindings across process restart;
- deployed Cloudflare edge and Durable Object match authority;
- durable SQLite-backed RPG service wiring;
- authentication and service-to-service authorization;
- duplicate/retry and reconnect validation across deployed components;
- operational logging, quotas, backup, and recovery.

### Team-aware RPG battles

The initial adapter intentionally rejects cooperative campaign rosters because the existing Arena battle is a two-seat duel. The next multiplayer design must explicitly map:

```text
human player ID
→ campaign participant
→ team
→ controlled trainer or units
→ permitted actions
```

Enemy control must remain separately represented. Do not place a second human on the opposing seat merely to satisfy the duel contract.

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

After the encounter lifecycle is durable:

- persistent party and inventory projections;
- exploration and points of interest;
- quests, dialogue, NPCs, and campaign map state;
- additional encounter rulesets;
- generated campaign packages and assets;
- bounded context compilation and campaign-authoring tools.

These systems belong to the Dungeon Master runtime and campaign package architecture where appropriate. GameFrame should retain only the campaign-facing projections and tactical contracts it needs.

### Specialist game modules

- Chess with clocks, notation, Stockfish, strength profiles, and coaching
- Additional tactical and board-game modules
- Alternative Monster Master encounter themes without rewriting platform authority

## Deferred

- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
- Claims of production readiness before deployed canaries and recovery tests exist

## Validation note

GitHub Actions is currently unavailable for the active identity-cleanup and RPG encounter branch. No exact-head canonical validation is claimed until the service is restored and the final branch head is tested.
