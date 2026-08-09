---
title: RPG GM Runtime Boundary
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gameframe-interface-contract.md
---

# RPG GM Runtime Boundary

## Decision

RPG GM Runtime is a separate private project/service. It is not hosted, supervised, or persisted by Scribbles Runtime.

Exactly two campaign-agent capabilities exist:

- **Campaign Architect** — pre-play CampaignPackage authoring/validation;
- **Dungeon Master** — live referee, narration, entity performance, Ask-GM, freeform adjudication, and aftermath/intervention.

Entity Registry, Character Factory, Scene Registry, Observer Knowledge, WorldGraph services, Context Compiler, Tactical Activation Coordinator, and deterministic mechanic adapters are substrate, not extra agents.

GameFrame is the complete authenticated player application. Scribbles Runtime owns Theo and only any future connector needed for Theo to participate as an ordinary GameFrame player.

## GameFrame owns

- authenticated player/session/invitation authority;
- Role-Playing Games / Battle Simulator / game navigation;
- physical scene materialization and accepted materialization identity;
- x/y/facing and physical position recovery;
- collision/pathing/camera/picking/interaction range;
- contextual direct interaction UI;
- deterministic RPG Ruleset mechanics;
- character/controlled-entity authorization;
- same-map tactical state/outcomes/recovery;
- observer-safe world and campaign-chronicle presentation;
- standalone Monster Master Arena Battles/Battle Simulator lifecycle;
- media/asset resolution and presentation fallbacks.

GameFrame does not own hidden CampaignPackage truth or omniscient Dungeon Master context.

## RPG GM Runtime owns

- CampaignPackage schema/validation/hash/provenance/persistence/commitment;
- hidden campaign bible and WorldGraph semantic truth;
- campaign journal/revision;
- Entity Registry and Character Factory;
- semantic Scene Registry/membership;
- Observer Knowledge / People derivation;
- objectives/events/clues/relationships/important semantic history;
- Dungeon Master context compilation and semantic decisions;
- freeform intent interpretation;
- semantic scene transfer and meaningful world consequences;
- semantic Tactical Activation requirements/reasons/objectives;
- semantic reconciliation after deterministic GameFrame outcomes;
- provider routing/validation/retries/fallback.

Runtime does not own Pixi geometry, x/y movement, collision, camera, tactical legal-action execution, or the player's browser UI.

## Scribbles Runtime owns

Scribbles Runtime owns Theo's behavior/lifecycle and any bounded connector translating an authorized GameFrame observation/action boundary for Theo.

It does not own CampaignPackages, Dungeon Master context, NPC memory, semantic scenes, Observer Knowledge, RPG mechanics, or campaign orchestration.

## Command/transport boundary

**GameFrame RPG mutations use authenticated HTTP. WebSockets are projection/notification-only.**

This includes exploration movement. Per-step WASD/touch movement remains GameFrame physical authority and never enters Runtime journal/model traffic.

Runtime receives meaningful semantic requests/events only when its authority is required: Talk/entity performance, Ask-GM, Do Something Else, scene transfer, semantic world changes, event/check consequences, Tactical Activation coordination, and post-mechanic reconciliation.

## Freeform boundary

The Dungeon Master interprets what a player is attempting; it does not make the attempted result authoritative by writing prose.

```text
player intent
→ DM/referee interpretation when required
→ deterministic/semantic validation
→ accepted commit
→ world projection/render
→ narration/history presentation
```

A sentence such as “I release Cinder” cannot bypass deployment rules, ownership, scene presence, physical placement, or control authority.

## Character-performance boundary

Talking to an NPC targets one stable semantic entity.

The Dungeon Master performs that entity using a structurally scoped entity-performance context. The context excludes hidden referee truth the entity does not know.

Pell remains the first custody canary:

```text
referee knows X
Pell does not know X
→ Pell context excludes X

Pell legitimately learns X
→ Observer Knowledge records X
→ Pell context may include X later
```

## Origin/audience/audibility boundary

Keep distinct:

- semantic origin;
- semantic audience;
- in-fiction audibility/observation;
- Observer Knowledge acquisition;
- player-facing presentation.

Normal speech may be heard by nearby observers. A whisper can restrict hearing. Ask-GM is player-private by default and not fictional speech.

One semantic dialogue/narration event can later be shown both in-world and in an authorized campaign chronicle without duplicating truth.

## Tactical boundary

Campaign combat is coordinated through **Tactical Activation**, not Encounter Scene Compiler or Arena handoff.

```text
current semantic scene + current GameFrame materialization
→ Runtime validates semantic reason/objectives/participants/ruleset requirements
→ GameFrame activates deterministic tactical authority on the same map
→ deterministic result
→ Runtime reconciles semantic consequences where required
→ same scene resumes exploration
```

The standalone Monster Master Arena Battles product remains separate Battle Simulator lifecycle/regression substrate.

## Contract rules

- No direct cross-repository database/secret/prompt/lifecycle access.
- Player identity comes from authenticated GameFrame custody.
- Runtime uses a service principal and never impersonates a player.
- Contracts are versioned, bounded, validated, idempotent, observer/audience-scoped, and recoverable.
- Runtime-only truth never enters ordinary browser projections.
- GameFrame consumes semantic projections/events, not runtime-authored browser code.
- Runtime consumes structured mechanics/tactical outcomes, not combat prose.
- Generated media is presentation, not authority.
- Client-authored entity/player/controller IDs do not create authority.

## Current implementation posture

```text
SEE      complete
MOVE     complete
MOBILE   complete
TALK     active
CHANGE
TRAVEL
FIGHT
PROVE
```

Runtime's next active responsibility is TALK context custody and interaction semantics. Physical interaction targeting/range remains GameFrame authority.

## Governing rule

> Runtime is the private semantic campaign brain and Dungeon Master host; GameFrame is the physical/deterministic game. Integrate through explicit contracts, make model output proposals rather than state writes, and keep observer-scoped communication and same-map tactical continuity structurally correct.
