---
title: Monster Master RPG Reference Campaign
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master product family
shared_document_id: rpg-monster-master-reference-campaign-v1
shared_document_version: 6
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-monster-master-reference-campaign.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-monster-master-reference-campaign.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-platform-roadmap.md
  - rpg-campaign-architect-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# Monster Master RPG Reference Campaign

## Decision

Monster Master is the first handcrafted campaign for the reusable RPG platform and the gold standard for future Campaign Architect output.

The product family is:

- **Monster Master: Arena Battles** — the standalone tactical battler currently represented by existing Monster Master tactical identifiers;
- **Monster Master RPG** — the first complete campaign product using the same trainer, creature, tactical, and presentation foundation;
- **RPG platform** — the reusable Campaign Architect, CampaignPackage, Dungeon Master, durable world substrate, GameFrame, and integration architecture proven by Monster Master.

Monster Master does not use a special Dungeon Master. It is authored into the same CampaignPackage contract that future generated campaigns must satisfy.

## Gold-standard purpose

The team manually creates everything the Campaign Architect should eventually produce:

- player-safe premise and roles;
- setting rules and campaign bible;
- hidden truth and continuity invariants;
- actors, motives, secrets, relationships, and limits;
- locations and factions;
- campaign spine and opening;
- plot structure, clues, event pools, escalation, and resolution;
- checks, tactical opportunities, objectives, and consequences;
- initial entity/scene/knowledge state required for deterministic world initialization;
- semantic asset and media requirements;
- provenance, validation, versions, and deterministic fallbacks.

This gives the project:

1. a playable first campaign;
2. a complete reference CampaignPackage;
3. a quality bar for later generated campaigns;
4. a stable Dungeon Master behavior fixture;
5. an Entity/Scene/Knowledge continuity fixture;
6. a GameFrame and Arena Battles integration fixture.

## Current source material versus executable package

The current lore, plot-family catalog, event pools, NPC pool, asset register, and deterministic fixture are valuable source material.

They are not automatically a complete CampaignPackage. The first campaign implementation must select and finish one coherent package with actual actors, locations, clue graph, event eligibility, pressure state, resolution, player-safe identity state, initial scene truth, and presentation requirements.

Additional catalog families become later packages or package templates after the first complete campaign loop works.

## Prepared asset foundation

GameFrame owns the prepared Monster Master theme and asset foundation, including:

- trainer and recurring NPC portraits;
- reusable NPC portrait families and incidental fallbacks;
- creature sprites, silhouettes, field derivatives, and effects;
- field-station, settled-route, work-zone, public-event, and tactical environments;
- route, handheld cube, cube-case/rack, kit, barrier, cargo, permit, evidence, and inspection props;
- private observation, investigation, warning, objective, People/current-scene, and aftermath presentation;
- deterministic placeholders and fallback mappings;
- stable asset IDs, manifests, provenance, rights notes, and derivative recipes.

The CampaignPackage declares semantic requirements. GameFrame resolves them through accepted assets, deterministic composition, generation, or readable fallback.

No single plot family or deterministic fixture controls the complete asset pack.

## First executable campaign requirements

The first gold-standard Monster Master package must include:

- one starting academy, settlement, or field station;
- one nearby settled route and incident area;
- a bounded player role and party-cohesion mechanism;
- a bounded starter-creature roster where needed;
- one veteran guide and a prepared recurring cast;
- actual important actors selected from or compatible with the NPC pool;
- one committed hidden cause;
- one public anomaly;
- redundant or recoverable clue paths;
- active pressure and escalation;
- multiple social, practical, care, investigative, deceptive, avoidant, and tactical approaches where credible;
- one deterministic noncombat check opportunity;
- one persistent choice or consequence;
- explicit initial scene participants/objects/exits and player-known identity state sufficient for runtime bootstrap;
- one Arena Battles encounter only when state reaches a tactical threshold;
- structured survivors, injuries, escape/withdrawal/custody, creature condition, evidence, route, relationship, and resource consequences as supported;
- one complete immediate resolution;
- one optional continuation seed;
- text-first and deterministic asset fallbacks;
- restart and resume support.

The first engineering proof may use a bounded starter chapter. Monster Master remains intended to grow into a durable multi-session campaign rather than a one-shot-only product.

## Dungeon Master boundary

The Dungeon Master may generate or adapt:

- narration, dialogue, descriptions, humor, and local history;
- NPC mannerisms and package-compatible reactions;
- clue wording and sensory framing;
- secondary complications and optional leads;
- reactions to expected and unexpected player plans;
- requests for ordinary incidental people or local entities when live play needs them;
- connective detail that does not become durable campaign truth until validated and committed.

When an unprepared ordinary person is needed, the Dungeon Master requests a bounded role from **Character Factory**. Character Factory materializes the stable entity; Scene Registry admits that entity to the appropriate scene; player knowledge is updated only as authorized. The Dungeon Master then portrays that committed entity.

The Dungeon Master may not:

- change package truth;
- switch plot after commitment;
- directly mint unconstrained durable NPC IDs through prose or generic state writes;
- move or invent decisive evidence to force an outcome;
- replace a responsible actor because players suspect correctly;
- contradict discovered clues, prior consequences, scene presence, or tactical outcomes;
- reveal runtime-only package fields or hidden canonical names;
- turn suggestions into the complete action space.

## Deterministic fixture rule

The repository may maintain deterministic packages for validation. Every such fixture must be marked noncanonical, versioned, replaceable, and excluded from default product copy and creative authority.

A deterministic fixture proves contracts, visibility, retry, persistence, and integration. It does not prove Dungeon Master quality, multiple campaigns, or Campaign Architect generation.

## Platform proving sequence

1. define and implement the CampaignPackage contract;
2. complete one handcrafted Monster Master package;
3. establish durable entity, scene, player-knowledge, and safe-rendering substrate;
4. commit and run Monster Master through the Dungeon Master;
5. prove it with scripted multi-turn players and mock/configured providers;
6. add the minimum checks, clue state, event progression, Character Factory continuity, and scene-faithful tactical handoff required by that package;
7. make the package playable through GameFrame and prove authoritative Arena return/recovery;
8. author and run a materially different **second handcrafted package** through the same runtime architecture;
9. repair common abstractions if that second package exposes campaign-specific control-plane assumptions;
10. implement Campaign Architect against the now-proven package/runtime contract;
11. generate and run a materially different bespoke campaign through the same Dungeon Master;
12. expand Monster Master packages, assets, and multi-session systems;
13. add richer intake and media generation.

## Testing role

Monster Master is the principal end-to-end campaign fixture.

Testing must separately prove:

- package validation and commitment;
- durable entity identity and scene presence;
- viewer-specific names/People knowledge;
- Dungeon Master continuity and freeform behavior;
- hidden-truth and hidden-name stability/secrecy;
- incidental NPC request/materialization and later reappearance;
- missed-clue recovery;
- Act/Speak versus Ask-GM;
- checks and consequences;
- actual Arena Battles launch, structured terminal outcome, and authoritative campaign unlock/return;
- reconnect, restart, exact retry, and resume;
- a second materially different handcrafted package;
- eventual Campaign Architect output through the same harness.

A transport round trip, catalog-shape test, canned opening, or browser return link does not satisfy this campaign proof by itself.

## Ownership

### RPG GM Runtime owns

- handcrafted package encoding and future Campaign Architect orchestration;
- package validation, commitment, persistence, and hidden truth;
- Entity Registry, Character Factory, Scene Registry, player knowledge, and Dungeon Master context/orchestration;
- freeform interpretation, NPC continuity, clues, events, consequences, and tactical requests.

### GameFrame owns

- campaign intake and player-safe preview interfaces;
- authenticated player experience and audience projections;
- People/current-scene/Act-Speak/Ask-GM presentation;
- semantic asset resolution and media materialization;
- prepared Monster Master presentation;
- structured mechanics deliberately promoted into GameFrame;
- Arena Battles authority and terminal outcomes.

## Non-goals

The reference campaign does not require:

- one canonical mystery every group replays;
- a separate Monster Master Dungeon Master;
- unrestricted campaign invention during live play;
- Dungeon Master-owned durable incidental identities;
- generated media as a logic dependency;
- production art for every catalog family before the first package works;
- an open world before the bounded campaign proof is complete;
- immediate migration of compatibility identifiers;
- copying protected settings, creatures, characters, terminology, or plots.

## Governing rule

> Handcraft one complete Monster Master CampaignPackage, make it a durable world with explicit entities/scenes/knowledge, prove authoritative GameFrame tactical return, prove the same runtime with a second handcrafted package, and only then automate campaign construction with the Campaign Architect.
