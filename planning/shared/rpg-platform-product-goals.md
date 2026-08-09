---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 8
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-product-goals.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-product-goals.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Product Goals

## Product statement

The RPG platform is a persistent **embodied generative role-playing system** played through GameFrame.

RPG GM Runtime owns durable semantic campaign truth and bounded Dungeon Master intelligence. GameFrame materializes that truth into a persistent playable 2D world and owns deterministic mechanics, physical control, tactical authority, and presentation.

Ordinary supported actions should increasingly happen directly in the world. The Dungeon Master remains available for narration/framing, NPC performance, Ask-GM, unusual freeform actions, consequences, and rulings that fixed controls cannot express.

> The graphics visualize and operationalize the imagination; they do not define the limits of the imagination.

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

**GameFrame RPG Engine** is internal reusable architecture, not a player-facing game card.

Campaign tactical play and Battle Simulator may share ruleset/tactical implementation, but campaign combat never launches Battle Simulator.

## Product hierarchy

- **GameFrame RPG Engine** — reusable embodied campaign engine inside GameFrame.
- **RPG Ruleset** — deterministic game-specific mechanics/capabilities independent of one campaign.
- **Game Family** — reusable rules/content/assets identity shared by related campaign/simulator experiences.
- **CampaignPackage** — durable semantic campaign/world/story/cast/location/event artifact.
- **Battle Pack** — simulator-safe tactical content/configuration referencing the same game-family/ruleset without duplicating combat rules or leaking campaign secrets.
- **BattleScenario** — one standalone tactical setup.

Monster Master proves the first shared family:

```text
Monster Master RPG
= GameFrame RPG Engine
+ Monster Master Ruleset / family content
+ Monster Master CampaignPackage

Monster Master Arena Battles
= Battle Simulator
+ Monster Master Ruleset / family content
+ Monster Master Battle Pack
+ BattleScenario
```

## Two specialized campaign agents

Exactly two campaign-agent responsibilities remain:

1. **Campaign Architect** — pre-play authoring/validation of CampaignPackages and later compatible reusable game-family/Battle-Pack material after generality is proven.
2. **Dungeon Master** — live referee/world adjudication, narration, Ask-GM, entity performance, unusual intent interpretation, pacing/consequences, and aftermath/intervention.

Character performance is a Dungeon Master context mode, not a third NPC agent.

## Authority split

### RPG GM Runtime

Owns committed CampaignPackage and hidden truth, WorldGraph/location semantics, Entity Registry, semantic Scene Registry/membership, Observer Knowledge, objectives/events/clues/relationships/semantic history, Dungeon Master context modes and semantic decisions, semantic scene transfer and meaningful consequences, and semantic Tactical Activation requirements/reconciliation.

### GameFrame

Owns authenticated player/session authority, physical scene materialization, x/y/facing and physical position recovery, collision/pathing/camera/picking/interaction range, contextual player controls, deterministic RPG Ruleset mechanics, character/controlled-entity authorization, tactical state/outcomes/recovery, player-facing world/history presentation, and standalone Battle Simulator lifecycle.

## Embodied freedom rule

Direct controls are convenience and legibility, not the complete action vocabulary.

At any time a player may use **Do Something Else** to submit a plausible unsupported in-fiction intent. The Dungeon Master interprets what the player is attempting; deterministic/semantic authorities determine what actually succeeds.

Example:

```text
"I pull out Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate ownership/deployment rules/current state
→ commit accepted semantic + physical change
→ render Cinder in the world
→ narrate/log the accepted result
```

**Prose is not authority.** Declarative wording cannot create inventory, bypass collision/locks, mint entities, force NPC outcomes, or overwrite committed world truth.

## Interaction modes

The mature player experience distinguishes Explore, Interact, Talk, Do Something Else, Ask Game Master, GM Intervention, Tactical Mode, and Campaign Chronicle.

The world is the primary play surface. The chronicle/history is supporting presentation, not the permanent main controller.

## Observer, audience, and communication goal

Physical presence, observer knowledge, audibility, semantic audience, and UI presentation are related but not interchangeable.

- nearby normal speech may be heard by nearby observers;
- a whisper may intentionally restrict who hears it;
- Ask-GM is player-private by default and is not fictional speech;
- another player does not learn a fact merely because one client's UI displayed it;
- canonical entity names remain hidden until that observer legitimately knows them.

One semantic event may have multiple authorized presentations. A Pell line can appear as a temporary in-world bubble/subtitle and later as a campaign-history entry without becoming two separate truths.

## Campaign Chronicle goal

The current campaign feed should mature into a readable **campaign chronicle**, not a tiny combat log and not the primary game controller.

It may retain meaningful opening/scene narration, dialogue the observer actually heard/participated in, discoveries and knowledge reveals, consequential player actions, deterministic mechanic outcomes, persistent world changes, scene transitions, and GM interventions/rulings appropriate to that audience.

It should not need every movement step, camera turn, hover, or transient animation. Different observers may legitimately have different chronicle entries.

## Persistent world goal

Campaigns are durable worlds, not disposable model conversations.

Preserve stable campaign/entity/location/item identities, semantic scene presence, observer-specific knowledge/beliefs, persistent/reproducible GameFrame materializations, meaningful environmental changes, deterministic retry/reconnect, semantic correction/history, and separate Runtime/GameFrame authority positions.

High-frequency movement remains GameFrame physical/session state. Meaningful scene/world changes become durable semantic operations.

## Same-map tactical rule

When initiative is required, the **current materialized scene** enters Tactical Mode through validated Tactical Activation.

Current positions, people, monsters, objects, terrain, collision geometry, and exits remain the world. Tactical overlays/action economy become active, deterministic outcomes commit, semantic reconciliation occurs where required, and exploration resumes in place.

No campaign Arena handoff or Return-to-Campaign screen.

## Ruleset-defined control

The generic engine must not hardcode one principal → one unit. Monster Master must support a human principal controlling their own Master/trainer plus one or more deployed monsters according to class/ruleset limits.

## World/materialization goal

CampaignPackage owns semantic WorldGraph/location intent. GameFrame realizes it through accepted assets, deterministic authored/procedural composition, reusable world kits/prefabs, bounded generated presentation assets when justified, and validated fallbacks.

Once accepted for a campaign instance, scene materialization identity and meaningful state persist across revisit/reconnect.

## Deployment goal

Initial production remains Cloudflare public boundary + private VM services:

- public GameFrame through Cloudflare;
- no inbound router forwarding/player VPN requirement;
- private loopback GameFrame RPG authority and RPG GM Runtime;
- separate services/stores/secrets;
- **HTTP owns RPG commands/mutations, including exploration movement**;
- **WebSockets are projection/notification-only and reconstructable from durable state**;
- no per-step movement traffic to RPG GM Runtime.

## First product proof

```text
Role-Playing Games
→ Monster Master RPG
→ persistent Crooked Checkpoint
→ movement
→ direct Pell interaction with Pell-scoped knowledge
→ Ask-GM / Do Something Else
→ persistent world change
→ West Woods travel/revisit
→ event/check consequence
→ same-map Tactical Activation
→ Master + ruleset-authorized monster actions
→ tactical result
→ exploration resume
→ restart/reconnect
→ same persistent world
```

Then prove two humans in one shared scene, then a materially different second handcrafted Game Family, and only then activate Campaign Architect/dynamic Battle Pack productization.

## Governing rule

> Make the world the game, keep arbitrary plausible intent legal, require authoritative commits before narration claims consequences, preserve observer-scoped knowledge/communication/history, and let the campaign chronicle record meaningful play without replacing embodied play.
