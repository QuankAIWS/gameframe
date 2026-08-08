---
title: Monster Master RPG Canonical Baseline
status: accepted
document_type: authority-index
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - Monster Master RPG
  - Monster Master: Arena Battles
  - Scribbles GameFrame
  - RPG GM Runtime
related:
  - rpg-documentation-index.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-campaign-architect-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rpg-encounter-rules.md
  - monster-master-rpg-asset-register.md
  - monster-master-rpg-npc-pool.md
  - decisions/0006-monster-master-capture-cube-form-factor.md
---

# Monster Master RPG Canonical Baseline

## Purpose

This is the required Monster Master starting point. Platform architecture is controlled by the shared agent/package and scene/entity/knowledge contracts; implementation order is controlled by the shared roadmap.

Monster Master is the first handcrafted campaign built for that reusable platform. It is not a special Dungeon Master implementation or the platform architecture itself.

## Platform context

### Campaign Architect

The Campaign Architect creates complete validated CampaignPackages from player concepts, owner-authored specifications, structured sheets, prepared settings, later GameFrame/Discord interviews, or imported packages.

For Monster Master, the team manually performs that authoring work to establish the quality bar.

Generated and handcrafted packages may both be refined before commitment:

```text
source / brief
→ draft CampaignPackage
→ optional owner editing
→ validation/repair
→ preview
→ commitment
```

### Dungeon Master

The Dungeon Master consumes one committed CampaignPackage and typed durable campaign state. It conducts narration, NPC performance, freeform interpretation, pacing, eligible events, consequences, checks, and tactical requests.

The Dungeon Master may adapt strongly but may not replace package truth, responsible actors, evidence logic, established facts, prior consequences, entity identity, or authoritative tactical outcomes.

The Dungeon Master may request ordinary incidental characters. Runtime Character Factory materializes them as validated stable entities; the model does not directly mint unconstrained durable NPCs through prose.

There is no separate intro agent.

## Durable world rule

Monster Master campaign truth is not a transcript stored in the model's memory.

Runtime owns explicit state for:

- durable people/creature identities;
- current scene membership;
- current location and relevant scene objects;
- player/party knowledge;
- known versus hidden identity labels;
- objectives, clues, events, relationships, rosters, checks, and consequences.

A character can physically act in a scene only when current scene state places them there or an explicit remote channel exists.

A player may know a stable entity first only by description and later by name. GameFrame must use the viewer-authorized label rather than the runtime's canonical hidden name.

## Monster Master role

Monster Master is:

1. the first playable RPG campaign;
2. the handcrafted gold-standard CampaignPackage;
3. the quality bar for future Campaign Architect output;
4. the principal Dungeon Master/entity/scene/knowledge continuity fixture;
5. the proving ground for GameFrame presentation and Arena Battles integration.

The existing plot/NPC catalogs are source material. They are not complete campaigns until selected and committed into an executable package.

## Repository ownership

### GameFrame owns

- canonical public/shared RPG contracts;
- authenticated player identity, seats, invitations, and player UI;
- Monster Master lore/creative direction;
- viewer-safe scene/People/character presentation;
- Act/Speak and Ask-GM input surfaces;
- semantic asset materialization;
- deterministic mechanics promoted into GameFrame;
- Arena Battles legal actions, persistence, replay, and terminal outcomes.

### RPG GM Runtime owns

- package schema/validation/persistence;
- private packages/hidden truth;
- Entity Registry, Character Factory, Scene Registry, and player-knowledge projection;
- Dungeon Master orchestration/context/continuity;
- actor secrets, clue answers, event eligibility, incidental NPC instances;
- scene-to-encounter semantic projection;
- mapping GameFrame outcomes into campaign consequences.

Shared documents are canonical in GameFrame and mirrored byte-for-byte into runtime.

## Document authority order

1. `shared/rpg-agent-architecture-and-campaign-package.md`;
2. `shared/rpg-scene-entity-and-knowledge-contract.md`;
3. `shared/rpg-platform-roadmap.md`;
4. this baseline;
5. `monster-master-rpg-current-creative-direction.md`;
6. `monster-master-rpg-lore-and-story.md` and accepted decision records;
7. `monster-master-rules.md` for fixed MM-0001;
8. `monster-master-rpg-encounter-rules.md` for campaign tactical evolution;
9. specialist contracts/asset/NPC registries;
10. repository-local implementation ledgers when compatible with the above.

## Reconciled Monster Master decisions

### Tone and agency

Monster Master is adult fantasy adventure supporting dry humor, broad comedy, slapstick, absurd professional culture, selective meme-adjacent concepts, sincere relationships, tactical danger, funny horror, and bounded genuine horror.

Heroic/lawful play is valid but not mandatory. Practical, selfish, opportunistic, illegal, reckless, avoidant, and unexpected actions may be credible. Consequences come through the world rather than invisible morality correction.

### Starter structure

The certification circuit is a reusable chassis, not a mandatory scene order. The current handcrafted package uses the Crooked Checkpoint incident as its committed first reference campaign, but deterministic test fixtures do not become broader product canon merely by existing.

### NPCs

Prepared roles provide recurring anchors and visual coverage, but the cast is open.

Package-bearing actors are bound before play when campaign truth requires them. Incidental NPCs may be requested during play and receive stable IDs/appearance/continuity through runtime substrate.

An incidental NPC cannot retroactively become a committed culprit, decisive witness, clue owner, or secret authority unless the package explicitly left that role open.

### Monster Master identity

A Master is normally a human trainer/player character. Trainers and monsters are separate rules/asset families.

Trainers have archetypes, abilities, equipment, social roles, and meaningful participation in adventure play. Campaign tactical rules should add trainer combat/support profiles only when GameFrame implements them deterministically.

### Capture cubes

Capture cubes contain private interior living spaces and quality/accommodation systems as described in the lore document.

**Ordinary capture cubes are handheld externally.** Their interior size is not constrained by exterior volume. Cases, racks, carts, and specialist relocation/quarantine equipment are separate objects. See `decisions/0006-monster-master-capture-cube-form-factor.md`.

Do not depict an ordinary cube as a cage-sized container merely because a large monster lives inside.

### Assets

CampaignPackage declares semantic asset requirements. GameFrame resolves/generates/composes/stores accepted presentation assets.

Cloudflare-backed generation is a campaign-preparation/presentation capability, not a campaign-logic prerequisite.

## Player knowledge and People view

Monster Master should make character knowledge visible to players rather than relying on memory of previous narration.

The target People/Characters surface shows only viewer-authorized information:

- people the character knows exist;
- current best known identity label;
- known role/facts;
- relationship/meeting context;
- current presence where known;
- portrait/fallback.

Unknown people and hidden names remain absent.

For example, the same runtime entity may appear as:

```text
"the woman in inspector's gear"
→ "the checkpoint inspector"
→ "Mara Venn"
```

as play authorizes new knowledge.

## Act/Speak versus Ask Game Master

The player interface must distinguish an in-fiction action from a player-to-GM question.

- **Act / Speak** enters ordinary fictional-world action semantics.
- **Ask Game Master** asks about rules, remembered knowledge, licenses, known lore, or clarification without automatically making the character say it aloud or advancing time.

This is a protocol/UI distinction, not a prompt-only convention.

## Arena Battles boundary

MM-0001 remains the fixed standalone duel with its own small roster/rules contract.

Monster Master RPG campaign encounters reuse GameFrame tactical infrastructure but must progressively preserve current-scene truth under `monster-master-rpg-encounter-rules.md`.

The target campaign handoff preserves, as supported:

- exact trainer/monster/NPC entity identity;
- allied/hostile/neutral/noncombatant/escaping roles;
- relevant objects and exits;
- campaign objectives;
- withdrawal/escape/surrender/recall/incapacitation outcomes;
- exact structured terminal results returned to runtime.

Unsupported combat-relevant requirements fail closed instead of disappearing or being substituted with unrelated MM-0001 units.

## Current implementation order

1. keep the handcrafted package/staging journey executable;
2. implement durable Entity/Scene/Knowledge substrate;
3. structurally split hidden Dungeon Master decision from player-safe rendering;
4. expose People/current-scene and Act/Speak versus Ask-GM semantics through GameFrame;
5. make events/typed campaign operations and semantic repair durable;
6. evolve Monster Master RPG tactical handoff toward scene fidelity, starting with escape/withdrawal;
7. prove complete single-player campaign/restart;
8. add multiplayer lifecycle;
9. prove a materially different second handcrafted package;
10. implement Campaign Architect;
11. broaden media/multi-session systems afterward.

## Required test posture

Separate evidence for:

- package validation;
- entity/scene/knowledge state;
- hidden-name/secret rendering safety;
- Dungeon Master machine-play;
- transport/persistence;
- real GameFrame integration;
- scene-faithful Arena outcomes;
- player browser experience;
- VM/Cloudflare/Discord deployment.

No transport test, catalog assertion, canned opening, or generic duel roundtrip alone proves a working campaign.

## Superseded material

Do not follow designs that:

- send a raw premise directly to Dungeon Master and call it campaign creation;
- make the Dungeon Master invent package foundations;
- rely on prose/model recollection as sole entity or scene state;
- let hidden canonical names leak because the model knows them;
- create separate Monster Master/generic Dungeon Master services;
- preserve a third intro agent;
- treat catalogs as executable campaigns;
- make generated media mandatory for logic;
- silently drop present campaign entities when tactical mode starts;
- force campaign encounters into defeat-all-opposition because MM-0001 does;
- include Hyperbolic Time Cube or confirmed Class Five material in the starter package.

## Governing rule

> Handcraft Monster Master as a durable world, not a scripted transcript: preserve exact entities, scene presence, player knowledge, and consequences through one Dungeon Master and GameFrame path, then use that proven architecture as the target for generated campaigns.
