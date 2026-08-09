---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - README.md
  - ROADMAP.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-cloudflare-deployment-architecture.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rules.md
  - monster-master-rpg-encounter-rules.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - shared/rpg-monster-master-reference-campaign.md
  - decisions/0006-monster-master-capture-cube-form-factor.md
---

# RPG GameFrame Documentation

## Required reading order

1. `shared/rpg-platform-product-goals.md` — product hierarchy, embodied-world objective, freeform agency, campaign chronicle role.
2. `shared/rpg-agent-architecture-and-campaign-package.md` — two-agent architecture, CampaignPackage, Game Family, Battle Pack.
3. `shared/rpg-scene-entity-and-knowledge-contract.md` — durable identity, Scene Registry, Observer Knowledge, player-safe disclosure.
4. `shared/rpg-embodied-exploration-and-character-performance-contract.md` — world-first interaction, entity-performance custody, speech/audibility, Ask-GM, freeform intent, campaign chronicle semantics.
5. `shared/rpg-platform-roadmap.md` — controlling cross-repository milestone order.
6. `ROADMAP.md` — current GameFrame-local implementation/evidence.
7. `monster-master-rpg-canonical-baseline.md` — Monster Master-specific accepted baseline.
8. `monster-master-rpg-current-creative-direction.md` — current opening/pacing/interaction/content direction.
9. `monster-master-rpg-lore-and-story.md` — detailed accepted lore such as capture-cube form factor.
10. `monster-master-rules.md` — fixed standalone MM-0001 regression rules; do not treat them as the mature campaign ruleset.
11. `monster-master-rpg-encounter-rules.md` — evolving same-map Monster Master campaign Tactical Activation rules.
12. Read the specific interface/deployment/testing/asset contract needed by the active slice.

Do not reconstruct current architecture from chat history, stale fixtures, old work orders, or legacy Arena behavior.

## Current status

```text
SEE      ✅
MOVE     ✅
MOBILE   ✅
TALK     ← ACTIVE
CHANGE
TRAVEL
FIGHT
PROVE
```

The world is now the primary product surface. Campaign-feed UX polish is intentionally deferred while direct world interaction is incomplete, but feed/history **correctness**—observer-safe identity, origin, audience, audibility, and committed-event semantics—must be preserved now.

## Official terms

- **Games** — top-level player destination.
- **Role-Playing Games** — campaign surface.
- **Battle Simulator** — standalone tactical sandbox.
- **GameFrame RPG Engine** — internal reusable embodied RPG engine.
- **RPG Ruleset** — deterministic game-specific mechanics/capabilities independent of one CampaignPackage.
- **Game Family** — reusable rules/content/assets identity.
- **CampaignPackage** — durable semantic campaign artifact.
- **Battle Pack** — simulator-safe tactical content/configuration referencing shared rules/content.
- **BattleScenario** — one standalone tactical setup.
- **Campaign Architect** — pre-play campaign authoring/validation agent.
- **Dungeon Master** — live referee/narrator/entity-performance/Ask-GM/aftermath agent.
- **Entity Registry** — stable campaign entity identity.
- **Scene Registry** — semantic scene/presence authority.
- **Observer Knowledge** — sparse per-observer semantic knowledge/beliefs.
- **WorldGraph** — semantic location/route relationships.
- **Exploration Materialization** — GameFrame playable realization of semantic scene intent.
- **Tactical Activation** — current campaign scene enters turn-based authority without replacement map.
- **Do Something Else** — first-class arbitrary plausible in-fiction intent.
- **Ask Game Master** — out-of-fiction referee/knowledge communication.
- **Campaign Chronicle** — observer-authorized meaningful narration/dialogue/discovery/action/outcome/history; supporting presentation, not campaign authority.

## Player-facing hierarchy

```text
Games
├── Role-Playing Games
│   ├── Monster Master RPG
│   ├── future handcrafted/generated RPGs
│   └── Create RPG / My Campaigns / Import Campaign
├── Battle Simulator
│   ├── Monster Master Arena Battles
│   ├── future Battle Packs
│   └── Custom Battle / generated battlefield / import
├── Clockwork Checkers
├── Othello
└── Tic-Tac-Toe
```

## Core world loop

```text
semantic CampaignPackage/world
→ durable Entity/Scene/Observer Knowledge
→ GameFrame materialized exploration scene
→ movement + contextual interaction
→ targeted NPC/object/route action
→ deterministic mechanic and/or bounded semantic commit
→ player-safe world update
→ campaign chronicle presentation as appropriate
```

At any point:

```text
Do Something Else
Ask Game Master
```

When strict initiative is required:

```text
same materialized scene
→ Tactical Activation
→ turn-based authority
→ result/reconciliation
→ same scene resumes exploration
```

## Interaction/history boundary

One committed event may have multiple authorized presentations. A Pell line may appear in-world as a bubble/subtitle and later in an observer's campaign chronicle. That does not make two events.

Keep separate:

- event origin;
- semantic audience;
- physical audibility/observation;
- Observer Knowledge;
- UI presentation.

Normal nearby speech, whispers, private Ask-GM, and later split-party play can therefore produce different authorized histories for different players.

## Freeform state boundary

Player text expresses intent, not authority.

```text
"I release Cinder from her cube."
→ interpret deploy intent
→ validate rules/state
→ commit accepted semantic + physical change
→ render Cinder
→ narrate/log the accepted result
```

The model does not create state by writing successful prose.

## Transport boundary

**HTTP owns all RPG commands/mutations, including exploration movement. WebSockets remain projection/notification-only.**

No per-step movement belongs in RPG GM Runtime.

## Monster Master content corrections

- ordinary capture cubes are handheld externally;
- ordinary cube occupants do not physically shake/jump a full cart merely by moving in the cube interior;
- Crooked Checkpoint opening should orient, establish pressure, and return control rather than repeatedly funnel play through forced option lists;
- unintroduced actors use viewer-authorized descriptor/role labels until names are learned.

## Current development path

```text
TALK
→ generic interaction targeting/range
→ Pell entity-performance custody
→ speech audience/audibility
→ Ask-GM / Do Something Else

CHANGE
→ direct controls + freeform intent reach same authorities
→ persistent object/monster/world changes

TRAVEL
→ Crooked Checkpoint ↔ West Woods real transfer/revisit

FIGHT
→ same-map Tactical Activation

PROVE
→ complete single-player recovery/provider/staging proof
```

Then: two-human one-scene → second handcrafted Game Family → Campaign Architect → dynamic Battle Packs/Battle Simulator → split-party later.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Shared documents are mirrored byte-for-byte into RPG GM Runtime only after canonical GameFrame changes merge.

Accepted order:

1. merge canonical GameFrame shared docs;
2. synchronize Runtime mirrors;
3. run exact-byte drift/hygiene checks;
4. merge Runtime mirror/local-status updates.

## Documentation hygiene

Managed planning Markdown requires YAML front matter with at least `title`, `status`, `document_type`, `owner`, `last_updated`, and `applies_to`. Shared docs also carry canonical repository/path/version metadata and `sync_policy: exact-byte-copy`.

Validate with:

```bash
python3 scripts/check-rpg-planning-docs.py
```

## Governing rule

> Use the controlling docs, not historical accidents: the world is primary, arbitrary plausible intent remains legal, authoritative state precedes narration, observer scope precedes presentation, and current implementation order follows the next playable player action.
