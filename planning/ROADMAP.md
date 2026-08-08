---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - Monster Master Arena Battles
  - RPG GameFrame integration
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - rpg-gameframe-interface-contract.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- GameFrame is the authoritative game platform and complete authenticated player interface.
- Built-in deterministic opponents use `gameframe-bot` and game-specific bot presentation.
- `rpg-gm-runtime` owns CampaignPackages, Dungeon Master orchestration, hidden campaign truth, campaign journal, entity/scene/knowledge state, and narrative consequences.
- Scribbles Runtime is a separate future integration host for Theo.
- Theo may later join as an ordinary GameFrame player through an explicit connector. Theo is not a built-in opponent or Dungeon Master.
- MM-0001 remains the fixed standalone Monster Master duel. Monster Master RPG campaign encounters evolve through a separate scene-faithful encounter contract.

## Completed platform proofs

### GF-0001 — Tic-Tac-Toe walking skeleton

- server-authoritative two-seat matches;
- authenticated actions;
- revision, idempotency, replay, snapshot contracts;
- human/human and human/GameFrameBot flows.

### GF-0002 — Cloudflare-compatible match runtime

- storage-neutral asynchronous services;
- Durable Object storage and serialized authority;
- Worker routing and realtime projections;
- fail-closed identity behavior;
- persistence/eviction/competing-write coverage.

### GF-0003 — Browser delivery

- create/share/play/complete/resume/reconnect flows;
- responsive desktop/mobile paths;
- polling fallback;
- browser acceptance and visual review.

### GF-0004 — Discord identity and invitations

- website OAuth and Discord verification;
- signed sessions;
- stable `discord:<user-id>` principals;
- signed expiring invitations;
- hosted spoofing rejection.

### GF-0005 — Versioned decision-provider contract

Generic structured agent-player request/response validation exists. External agents remain ordinary players and do not become built-in GameFrameBot identities.

### GF-0006 / GF-0007 — American Checkers

Complete authoritative rules, deterministic CheckersBot, persistence, browser flow, and provider-compatible decision path.

### TC-0001 / TC-0002 — Tactical foundations

- semantic map/movement/occupancy;
- initiative and bounded activations;
- line of sight, attacks, health, effects, victory/draw;
- human/human and human/ArenaBot flows;
- Node/browser/Workers paths.

### MM-0001 — Monster Master Arena Battles foundation

- fixed `monster-master-duel` rules;
- three-unit standalone trainer teams;
- deterministic deployment/initiative/movement/attacks/health;
- command energy and Warden Master Mend;
- Monster Master BattleBot;
- replay/persistence/invitations/browser/Pixi rendering.

MM-0001 is deliberately small. It remains a useful standalone game and regression target.

### GF-0011A — Node-local RPG campaign → Arena semantic loop

The first campaign-to-battle loop proved one authenticated human plus BattleBot can move from a campaign presentation into a Monster Master match and return a structured result. Later work added shared-team cooperative tactical control without mapping allied humans onto opposing duel seats.

This was a semantic/in-memory adapter proof, not the final durable RPG encounter authority.

### GF-0011B — Durable Monster Master RPG encounter production substrate

Current durable implementation provides:

- existing SQLite RPG campaign/encounter custody;
- durable RPG-bound MatchSession snapshots;
- restart-safe encounter↔match binding;
- exact participant→creature mapping through `participantUnitIds`;
- shared-team action authorization distinct from assignment;
- process-death reconciliation after launch;
- serialized same-match mutation;
- terminal outcome derivation from authoritative match state;
- private VM RPG match routes behind authenticated/HMAC Worker proxying;
- HTTP polling for VM-owned `rpg:*` match projections;
- configured revision-zero Monster Master state for supported creatures;
- fail-closed unsupported configuration.

Current campaign tactical materializer is intentionally narrow:

- Emberling and Stone Bulwark tactical profiles;
- one through three supported creatures per side;
- equal creature counts because current deployment alternates two sides;
- compact-duel map;
- normal difficulty;
- defeat-opposition objective;
- trainers remain encounter participants/controllers but are not tactical units.

That bounded surface is proven substrate, not the desired final campaign rules model.

### GF-0012 — RPG staging delivery/control substrate

Current staging work includes:

- Cloudflare Worker + VM hybrid routing;
- private GM/runtime origin path;
- one-button private-runtime deployment authority;
- Discord-bound staging administration/reset control;
- package-first Monster Master staging campaign bootstrap;
- durable opening publication;
- authenticated player shell and onboarding work.

Deployment evidence remains separate from complete campaign-behavior evidence.

## Active product correction — durable campaign world, not model transcript

Recent playtesting exposed an architectural gap: the platform has strong package/journal/protocol mechanics, but current player experience still relies too heavily on model prose to carry facts that should be explicit state.

The controlling correction is `shared/rpg-scene-entity-and-knowledge-contract.md`.

The project now treats these as first-class runtime/player surfaces:

- durable entities;
- current scene membership;
- viewer-specific identity/name knowledge;
- People/Characters projection;
- explicit Act/Speak versus Ask-GM interaction;
- typed presentation origin;
- scene-to-Arena participant/objective continuity.

## Active — GF-0013 Scene and People player surfaces

GameFrame must consume viewer-safe runtime projections for:

- current scene;
- known people;
- known identity labels;
- known facts/relationships;
- current presence;
- player-safe entity inspection.

Unknown entities are omitted entirely. GameFrame does not expose hidden canonical names simply because runtime knows them.

The same durable runtime entity should be able to appear to a player as:

```text
"the woman in inspector's gear"
→ "the checkpoint inspector"
→ "Mara Venn"
```

without changing entity identity.

### UI goal

The RPG shell should provide a real **People** view alongside campaign history/objectives/companions. This is a player-character memory surface, not an admin view of runtime truth.

## Active — GF-0014 Act/Speak versus Ask Game Master

The single freeform composer must evolve into explicit semantic modes.

At minimum:

- **Act / Speak** submits an in-fiction action;
- **Ask Game Master** submits a player-to-GM rules/knowledge/clarification question.

Ask-GM must not automatically become dialogue heard by NPCs or advance time. The result should render as GAME MASTER/system guidance rather than fictional NPC reaction.

Presentation event origin should be distinct from audience so transcript headings can identify:

- PLAYER — <name>;
- GAME MASTER;
- viewer-safe NPC label;
- SYSTEM;
- TACTICAL ENCOUNTER.

## Active — GF-0015 Monster Master RPG scene-faithful tactical rules

The campaign tactical path should now evolve under `monster-master-rpg-encounter-rules.md` rather than broadening MM-0001 indiscriminately.

Target capabilities, implemented only as campaign needs prove them:

1. encounter-scene contract with exact entity roles;
2. withdrawal/escape terminal semantics and visible exit zones;
3. asymmetric scene materialization;
4. trainer tactical profiles;
5. bounded noncombatant/protected/support/neutral roles;
6. alternative objectives such as protect, prevent escape, secure object, reach location, or survive;
7. structured scene reconciliation after terminal outcome.

Unsupported combat-relevant requirements continue to fail closed.

### Crooked Checkpoint target

When the campaign enters Arena Battles, the tactical scene should derive from actual campaign state. Depending on prior choices, that may include:

- the player trainer;
- Cinder/selected monster;
- Warden Pell/support allies if present;
- established hostile people/monsters if still present;
- Emberglass if physically present, potentially with a flee objective;
- pack lizard/noncombatant state if relevant;
- cart/barrier/exit zones required by the objective.

The target is not to force every scene entity into a full combatant unit. The target is to prevent important campaign entities/objects/objectives from disappearing merely because tactical mode started.

## Active — Monster Master capture-cube presentation correction

Ordinary capture cubes are handheld externally despite much larger interior living spaces. GameFrame assets/UI should distinguish:

- handheld cube;
- cube case/rack;
- cart carrying cube cases;
- specialist relocation/quarantine/industrial containment equipment.

See `decisions/0006-monster-master-capture-cube-form-factor.md`.

## Single-player full-stack acceptance gate

The next complete product proof remains one authenticated human plus Monster Master BattleBot, but the acceptance criteria are now stronger than transport/tactical roundtrip alone.

Required journey:

```text
committed handcrafted CampaignPackage
→ durable current scene/entity state
→ viewer-safe People/knowledge projection
→ multiple real Dungeon Master turns
→ Act/Speak + Ask-GM semantics
→ executable event/check progression
→ scene-faithful Arena launch when justified
→ exact structured tactical outcomes
→ scene/world reconciliation
→ automatic aftermath
→ bounded campaign resolution
→ runtime + GameFrame restart/resume
```

This proves the complete single-player architecture. It does not prove multiplayer knowledge/audience behavior.

## Two-human campaign acceptance

After the single-player architecture is proven:

- two authenticated players join one campaign;
- explicit party/player knowledge diverges correctly;
- both use freeform action and Ask-GM surfaces;
- both see correct People/scene projections;
- shared-team cooperative Arena control uses stable principals and exact participant mapping;
- restart/resume preserves audiences and state.

## Future — Campaign Architect

Do not implement Campaign Architect merely because the contract is documented.

First prove a materially different second handcrafted package through the same package/entity/scene/knowledge/Dungeon Master/GameFrame path.

Then implement generated-draft authoring:

```text
brief
→ Campaign Architect draft
→ optional owner refinement
→ validation/repair
→ preview
→ commitment
```

## Future — media/materialization

After core campaign correctness:

- complete prepared asset packs;
- provider-neutral prompt compilation;
- Cloudflare-backed image generation;
- persistent character/location visual identities;
- replacement/version/provenance workflows;
- cutscene/scene-image composition.

Media remains presentation and may not own campaign truth.

## Future — specialist games

- Chess and other board games;
- additional tactical modules;
- alternative Monster Master encounter themes/rules without weakening authority boundaries.

## Deferred

- public discovery/subscriptions/monetization;
- native desktop/mobile clients;
- production-readiness claims before deployment/recovery canaries;
- generalized mechanics not yet demanded by real campaigns;
- Cloudflare-native migration of private campaign state without evidence that it is needed.

## Documentation posture

Use:

- `planning/rpg-documentation-index.md` for reading order;
- `planning/shared/rpg-platform-roadmap.md` for cross-repository milestone order;
- this file for GameFrame-local status/direction;
- `planning/shared/rpg-scene-entity-and-knowledge-contract.md` for durable world continuity;
- `planning/monster-master-rpg-encounter-rules.md` for campaign tactical evolution;
- `planning/monster-master-rules.md` for fixed MM-0001.

## Governing rule

> GameFrame should stop treating the RPG as narration wrapped around a separate duel. It must present the player's durable campaign world, preserve viewer knowledge, and carry that same world into authoritative mechanics without losing people, identity, or objectives at mode boundaries.
