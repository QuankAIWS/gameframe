---
title: Monster Master RPG Reference Campaign
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master product family
shared_document_id: rpg-monster-master-reference-campaign-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-monster-master-reference-campaign.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-monster-master-reference-campaign.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-one-shot-intro-agent-contract.md
  - rpg-cross-repository-integration-testing.md
  - ../tactical-battler-rpg-foundation.md
  - ../rpg-platform-delivery-plan.md
  - ../monster-master-rpg-current-creative-direction.md
  - ../monster-master-rpg-lore-and-story.md
---

# Monster Master RPG Reference Campaign

## Decision

Monster Master is the reference product family used to prove the RPG platform before broad theme-on-demand generation becomes a development dependency.

The intended product split is:

- **Monster Master: Arena Battles** — the standalone tactical battler currently represented by the `monster-master-duel` GameFrame definition;
- **Monster Master RPG** — the first complete campaign product, using the same creature, trainer, tactical, and presentation foundation while adding exploration, dialogue, progression, quests, collection, relationships, and persistent consequences;
- **RPG platform** — the reusable GameFrame and RPG GM Runtime architecture proven by Monster Master RPG and later applied to other prepared or generated campaign themes.

The player-facing rename and internal identifier migration are separate work. Existing identifiers may remain until explicitly migrated.

## Why Monster Master is the reference campaign

Monster Master exercises the intended product without making live generation a prerequisite for proving the Game Master.

It naturally requires:

- persistent player characters and creature rosters;
- NPC dialogue, humor, relationships, factions, rivals, criminals, professionals, and ordinary locals;
- exploration, locations, quests, secrets, checks, and consequences;
- creature collection, care, injuries, recovery, abilities, equipment, and progression;
- transitions between campaign scenes and tactical battles;
- recurring visual identities for trainers, creatures, locations, items, factions, props, and effects;
- a tone that can be funny, sincere, frightening, adventurous, and tactically dangerous;
- enough mechanical structure to test authority without reducing the campaign to a fixed script.

## Prepared asset foundation

Monster Master RPG begins with a prepared, versioned asset and theme pack owned by GameFrame.

The first pack should prioritize reusable foundation assets:

- trainer and recurring guide portraits;
- reusable local-role and rival portraits;
- creature sprites, silhouettes, field derivatives, and effects;
- field-station, settled-route, roadside, work-zone, and public-event compositions;
- route markers, carts, cubes, field kits, barriers, cargo, permits, and inspection props;
- private observation, investigation, warning, objective, and aftermath presentation;
- deterministic placeholders and fallback mappings;
- stable asset IDs, manifests, provenance, rights notes, and derivative recipes.

Family-specific extensions may then add selected creatures, props, locations, and actors for the first two or three playable plot families.

No one plot family or deterministic fixture controls the complete asset pack.

The first acceptance journey must not require a live image provider, live audio provider, or arbitrary theme compiler.

## Reference campaign shape

The first reference campaign is intentionally small but structurally complete. It has two related forms sharing the same chassis and catalog:

1. **Deterministic acceptance fixture** — one explicitly non-canonical selected package, fixed seed, prepared assets or fallbacks, and deterministic GM behavior used for repeatable integration evidence.
2. **Replayable starter expedition** — the same certification chassis with one package selected from several approved plot families and realized by the model, allowing materially different adventures.

The deterministic fixture proves platform mechanics. It is not the canonical story, default campaign copy, or creative priority.

Minimum authored content and coverage:

- one starting settlement, academy, or field station;
- one nearby settled route and wilderness or work-zone edge;
- two player characters and a bounded starter-creature roster;
- one veteran guide, one recurring rival role, and reusable local NPC roles;
- a compact certification circuit covering a useful mix of route work, creature care, capture or containment, delivery, licensing, or public service;
- a curated catalog with several materially different enabled plot families;
- one selected package committed before meaningful investigation;
- one public clue and one correctly scoped player-private observation;
- one freeform social, practical, care, investigative, deceptive, or avoidant action;
- one deterministic noncombat check and visible consequence;
- one bounded choice with persistent effect;
- one Arena Battles encounter only when selected state supports a tactical threshold;
- structured survivors, injuries, creature condition, objectives, evidence, and relationship consequences;
- return assessment, recap, disconnect, restart, and later-session resume;
- an immediate resolution that works as a complete one-shot plus an optional continuation hook.

## Starter catalog requirement

The starter catalog should include several different kinds of play rather than variations on one mystery.

The initial approved range includes:

- displaced domestic migration and ecological pressure;
- counterfeit or modified cube failures;
- rivalry and certification sabotage;
- festival or public-event creature breakouts;
- false authority, human crime, corruption, and rescue;
- specialty hazards only after their fixed rules and countermeasures are authored.

At least four enabled families should be capable of producing complete, materially different sessions. No family is canonical merely because it is used first by CI, docs, or asset production.

## Replayable starter architecture

### Shared chassis

The following remain stable across ordinary starter runs:

- joint academy or licensing sponsorship with warden field supervision;
- a mixed certification circuit along a settled route and nearby wilderness, work-zone, or public-event edge;
- a veteran guide who provides context and hard safety boundaries without solving manageable problems;
- opportunities for creature care, travel, licensing, practical work, social play, investigation, deception, avoidance, choice, consequence, and tactical handoff;
- prepared foundation assets and readable fallbacks;
- pacing bounds suitable for a one-shot, compact first session, or short starter arc;
- a return assessment and conclusion that can close cleanly or continue.

### Package selection

Before meaningful investigation, RPG GM Runtime selects or receives one approved package.

Selection may initially be explicit or deterministic. A broad weighted engine is not required.

The package commits at least:

- selected plot family;
- initial public anomaly;
- underlying cause;
- responsible and affected actors or forces;
- false interpretations where useful;
- required conclusions and evidence relationships;
- pressure and escalation logic;
- practical or moral complications;
- tactical threshold conditions;
- resolution branches and consequence mappings;
- optional continuation hook;
- package version and seed or provenance.

The package is campaign truth. Retries, reconnects, process restarts, model changes, early player insight, missed clues, and unexpected actions must not replace the selected family or cause.

### Model realization boundary

The model may generate or adapt:

- names, dialogue, descriptions, humor, local history, and NPC mannerisms;
- compatible motives and relationships;
- clue wording, scene framing, and sensory detail;
- secondary complications and optional leads;
- reactions to player plans and unusual approaches;
- connective tissue between current state and authored event material.

The model may not:

- retroactively change established truth;
- switch plot families after commitment;
- move or invent decisive evidence solely to force a preferred outcome;
- replace a responsible actor because players suspect the correct one;
- contradict exposed clues, committed state, tactical outcomes, or player-scoped information;
- reveal runtime-only fields through player projections.

### Replay, secrecy, and metagame protection

The runtime persists the selected package, catalog version, and seed or provenance.

A designer may know the chassis and available families without knowing a live campaign's selected truth. Hidden fields remain outside ordinary GameFrame screens, Discord narration, player exports, and recaps until discovered.

Starting a later campaign with a full group should select a new package unless an explicit seed or scenario is requested.

## Valid package requirements

A selected package is valid only when:

- its cause explains the public anomaly;
- every required conclusion has discoverable or recoverable evidence;
- at least two reasonable player approaches can advance or transform the situation;
- false interpretations remain plausible but optional;
- escalation follows from cause, meaningful time, or player action;
- noncombat resolution exists when credible;
- tactical conflict is mandatory only when current state justifies it;
- the one-shot resolution is complete even when the continuation hook is ignored;
- required presentation can resolve through prepared assets or readable fallbacks.

The initial implementation should prefer a small, well-tested catalog over unrestricted procedural invention.

## Platform proving order

### Stage 1 — Catalog, one CI package, and shared assets

Use a curated multi-family catalog, one explicitly non-canonical deterministic package, shared foundation assets, and mock or deterministic GM behavior.

Prove commands, audience projections, persistence, reconnect, hidden-state protection, evidence progression, and tactical handoff.

### Stage 2 — Model realization of the CI package

Allow RPG GM Runtime to produce dialogue, descriptions, reactions, and connective tissue while retaining the same committed CI package. Evaluate continuity, pacing, NPC behavior, intent interpretation, checks, consequences, and resistance to retroactive rewriting.

### Stage 3 — Multiple selected starter packages

Select and validate different packages from the enabled catalog while retaining the same chassis and shared asset foundation. Confirm that several runs remain coherent, replay-safe, visually supported, and materially different.

### Stage 4 — Family-specific asset extensions

Add only the assets needed by the first two or three playable families. Confirm that foundation assets remain reusable and that no family owns the entire presentation system.

### Stage 5 — Broader Monster Master campaigns

Extend beyond the starter circuit into additional chapters, locations, opponents, quests, and persistent arcs using the same package and realization boundaries.

### Stage 6 — Additional curated themes

Prove at least one materially different prepared theme pack using the same campaign contracts and presentation primitives.

### Stage 7 — Theme-on-demand generation

Only after prepared campaigns are reliable should arbitrary player inspiration routinely invoke theme translation, queued custom art, and optional synthesized narration.

## Ownership

### RPG GM Runtime owns

- private catalog contents and package selection;
- campaign semantics, committed truth, evidence relationships, actor motives, memory, dialogue content, and consequences;
- freeform player-intent interpretation;
- party, relationship, quest, and runtime-owned world continuity;
- requests for checks, choices, encounters, media intents, and narration intents;
- model orchestration and deterministic fallback.

### GameFrame owns

- the complete player interface;
- the Monster Master theme and asset foundation;
- family-extension asset resolution;
- authenticated commands and player-scoped projections;
- prevention of runtime-only fields leaking into player views;
- structured campaign mechanics promoted into GameFrame;
- Arena Battles mechanics, tactical replay, and committed outcomes;
- asset selection, composition, storage, delivery, and optional future generation;
- narration playback and text fallback.

## Testing role

Monster Master RPG is the reference end-to-end fixture for cross-repository integration.

The deterministic CI package must remain:

- explicitly non-canonical;
- deterministic when live models and providers are disabled;
- pinned to versioned catalog, package, and seed metadata;
- bounded enough for ordinary integration checks;
- rich enough to cover public, party-private, player-private, and runtime-only information;
- capable of proving that hidden truth does not leak through projections or recaps;
- capable of entering actual Arena Battles and applying the outcome;
- replayable after process restart and persistence eviction;
- independent of Tailscale and operator-local services.

Separate catalog journeys must prove package diversity. A successful deterministic fixture does not prove that the product supports several stories.

## Expansion gate

The platform should not prioritize arbitrary setting generation over the following proof:

1. the catalog contains several materially different enabled families;
2. a selected package is committed and preserved;
3. the GM maintains continuity without rewriting the selected plot;
4. the actual GameFrame tactical implementation accepts eligible encounters and returns structured outcomes;
5. campaign state applies tactical results and resumes;
6. audience-scoped information remains correct and runtime truth stays hidden;
7. exact retry, restart, and later resume preserve package truth;
8. another selected family produces a materially different valid starter;
9. presentation remains coherent through shared assets and family extensions without live generation;
10. the CI fixture remains a test mechanism rather than the default story.

## Non-goals

The reference campaign does not require:

- one canonical starter mystery every group must replay;
- final world size, creature roster, or balance;
- immediate migration of every internal identifier;
- an open world before the compact chapter works;
- unrestricted model invention without a committed package;
- live generated art for routine play;
- premium narration or distinct voices for every character;
- production art for every enabled family before initial testing;
- copying protected characters, creatures, settings, terminology, designs, or storylines.

## Governing rule

> Prove the Game Master with a multi-plot Monster Master starter catalog, one committed package per run, shared prepared assets, and the real Arena Battles path—while keeping deterministic fixtures explicitly non-canonical.
