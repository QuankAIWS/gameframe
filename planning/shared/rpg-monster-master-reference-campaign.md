---
title: Monster Master RPG Reference Campaign
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master product family
shared_document_id: rpg-monster-master-reference-campaign-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-monster-master-reference-campaign.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-monster-master-reference-campaign.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
  - ../tactical-battler-rpg-foundation.md
  - ../rpg-platform-delivery-plan.md
  - ../monster-master-rpg-lore-and-story.md
---

# Monster Master RPG Reference Campaign

## Decision

Monster Master is the reference product family used to prove the RPG platform before broad theme-on-demand generation becomes a development dependency.

The intended product split is:

- **Monster Master: Arena Battles** — the standalone tactical battler currently represented by the `monster-master-duel` GameFrame game definition;
- **Monster Master RPG** — the first complete campaign product, using the same creature, trainer, tactical, and presentation foundation while adding exploration, dialogue, progression, quests, collection, relationships, and persistent campaign consequences;
- **RPG platform** — the reusable GameFrame and RPG GM Runtime architecture proven by Monster Master RPG and later applied to western, science-fiction, horror, undersea-comedy, and other campaign themes.

The player-facing rename and any runtime identifier migration are separate implementation work. Until that migration is explicitly completed, tests and code may continue to use existing identifiers such as `monster-master-duel`.

## Why Monster Master is the reference campaign

Monster Master exercises the intended product without making live generation a prerequisite for proving the Game Master.

It naturally requires:

- persistent player characters and creature rosters;
- NPC dialogue, humor, relationships, factions, and recurring rivals;
- exploration, locations, quests, secrets, checks, and consequences;
- creature collection, training, injuries, recovery, abilities, equipment, and progression;
- transitions between campaign scenes and tactical battles;
- recurring visual identities for creatures, trainers, locations, items, factions, and effects;
- a tone that can be quirky and funny while permitting bounded darker material;
- enough mechanical structure to test authority without reducing the campaign to a fixed script.

This makes it a better initial platform proof than an arbitrary generated setting whose visual, semantic, and content failures would be difficult to separate from Game Master failures.

## Bespoke asset pack

Monster Master RPG begins with a prepared, versioned asset and theme pack owned by GameFrame.

The initial pack should contain or define:

- trainer and recurring NPC portraits;
- creature sprites or miniatures, silhouettes, animations, and effects;
- settlements, routes, interiors, wilderness, arenas, and encounter terrain;
- item, ability, quest, faction, creature, and character card treatments;
- interface ornamentation, palettes, typography guidance, transitions, particles, and audio mood;
- deterministic placeholders and fallback mappings;
- stable asset IDs, manifests, provenance, rights notes, and derivative recipes.

The first campaign acceptance journey must not require a live image provider, live audio provider, or arbitrary theme compiler. Prepared and deterministic assets are sufficient to prove the complete campaign loop.

## Reference campaign shape

The first reference campaign should be intentionally small but structurally complete. It has two related forms that share the same authored chassis:

1. **Deterministic acceptance fixture** — a fixed incident package, fixed seed, prepared assets, and scripted or deterministic GM behavior used for repeatable integration evidence.
2. **Replayable starter expedition** — the same campaign structure with a hidden incident package selected from approved pools and realized by the model, allowing designers and later player groups to encounter materially different adventures.

Minimum authored content and coverage:

- one starting settlement or academy;
- one nearby route or wilderness area;
- two player characters and a bounded starter creature roster;
- one veteran warden or field-specialist guide, one recurring rival, and reusable local NPCs;
- a compact certification circuit covering route inspection, field care, one supervised capture, and a delivery task;
- two or three linked scenes before the first battle;
- one public clue and one correctly scoped player-private clue;
- one freeform social or investigative action;
- one deterministic noncombat check and visible consequence;
- one bounded choice with a persistent campaign effect;
- one Arena Battles tactical encounter where the incident supports it;
- structured survivors, injuries, rewards, objectives, and relationship consequences;
- a return scene, assessment, recap, disconnect, restart, and later-session resume;
- an immediate resolution that works as a complete one-shot plus an optional open-ended continuation hook.

The deterministic fixture proves platform mechanics. The player-facing starter should not be locked to the fixture's culprit, evidence chain, monster species, escalation, or ending.

## Replayable starter architecture

The starter is a hybrid of authored structure, curated event pools, and model realization.

### Authored spine

The following remain stable across ordinary starter runs:

- joint academy or licensing sponsorship with warden field supervision;
- a mixed certification circuit along a settled route and nearby wilderness edge;
- a veteran guide who provides context and safety boundaries without solving the incident;
- opportunities for route inspection, monster care, supervised capture, delivery, social play, investigation, choice, consequence, and tactical handoff;
- prepared locations, interface treatments, encounter terrain, and fallback assets;
- pacing bounds suitable for a one-shot, compact first session, or short starter arc;
- a return assessment and a conclusion that can either close cleanly or continue.

### Hidden incident package

Before meaningful investigation begins, the RPG GM Runtime commits a runtime-only incident package containing at least:

- `incident_family`;
- `initial_anomaly`;
- `underlying_cause`;
- `responsible_actor_or_force`;
- `affected_people_and_monsters`;
- `false_interpretation`;
- `required_clues` and their logical relationships;
- `escalation_event`;
- `moral_or_practical_complication`;
- `tactical_condition`;
- `resolution_branches` and consequence mappings;
- `continuation_hook`;
- `package_version` and `incident_seed`.

The package is campaign truth, not a suggestion. Once committed, retries, reconnects, process restarts, model changes, and unexpected player actions must not replace the culprit, cause, or required evidence structure.

### Model realization boundary

The model may generate or adapt:

- names, dialogue, descriptions, humor, local history, and NPC mannerisms;
- compatible motives and relationships;
- clue wording, scene framing, and sensory detail;
- secondary complications and optional leads;
- reactions to player plans and unusual approaches;
- connective tissue between authored beats and committed truth.

The model may not:

- retroactively change established campaign truth;
- move or invent decisive evidence solely to force a preferred outcome;
- replace the responsible actor after players suspect the correct one;
- contradict exposed clues, committed state, tactical outcomes, or player-scoped information;
- reveal runtime-only fields through ordinary player projections.

Secondary details may be finalized after players commit to a route or approach when doing so increases variety, but those details must remain compatible with all committed facts and exposed evidence.

### Replay, secrecy, and metagame protection

The runtime must persist the selected package and seed. Deterministic seeds support CI, acceptance, reproduction, and debugging. Live campaigns may use approved weighted pools and model realization while remaining replay-safe after every state transition.

A designer may know the chassis and available incident families without knowing the selected truth. Hidden package fields must remain outside ordinary GameFrame screens, Discord narration, player exports, and session recaps until discovered through play.

Starting a later campaign with a full group should create a new incident package rather than replaying the designer's test mystery unless an explicit seed or scenario is requested.

## Initial incident generator contract

The first implementation should separate four layers:

1. **Chassis definition** — fixed instructional and pacing requirements.
2. **Curated pools** — approved incident families, anomalies, causes, actors, affected monsters, clue patterns, complications, tactical conditions, and hooks.
3. **Committed package** — the selected hidden truth and required evidence graph for one campaign.
4. **Realization state** — generated names, dialogue, descriptions, secondary details, and adaptations that remain subordinate to the committed package.

A generated package is valid only when:

- its cause explains the initial anomaly;
- every required conclusion is supported by discoverable evidence;
- at least two reasonable player approaches can advance the investigation;
- the false interpretation is plausible but not mandatory;
- escalation follows from the incident or player delay rather than appearing arbitrarily;
- the tactical encounter is optional when nonviolent resolution is credible and mandatory only when the committed situation requires it;
- the one-shot resolution is complete even if the continuation hook is ignored;
- all required creatures, locations, effects, and encounter configurations can resolve through prepared assets or deterministic fallbacks.

The first implementation should prefer a small, well-tested family pool over unrestricted procedural invention.

## Platform proving order

### Stage 1 — Fixed package and fixed assets

Use a deterministic Monster Master starter package, prepared theme pack, and mock or scripted GM. Prove campaign commands, audience projections, persistence, reconnect, hidden-state protection, evidence progression, and tactical handoff.

### Stage 2 — Model realization of a fixed package

Allow the RPG GM Runtime to produce dialogue, descriptions, reactions, and connective tissue while retaining the same committed incident package and prepared assets. Evaluate continuity, pacing, NPC behavior, intent interpretation, checks, consequences, and resistance to retroactive mystery revision.

### Stage 3 — Variable Monster Master starter packages

Allow the runtime to select and validate different incident packages from approved event pools while retaining the authored certification chassis and bespoke asset catalog. Confirm that multiple runs remain coherent, replay-safe, visually supported, and materially different.

### Stage 4 — Broader Monster Master campaigns

Extend beyond the starter circuit into additional chapters, locations, opponents, quests, and persistent arcs using the same committed-truth and realization boundaries.

### Stage 5 — Additional curated themes

Prove at least one materially different prepared theme pack using the same campaign contracts and presentation primitives.

### Stage 6 — Theme-on-demand generation

Only after the prepared campaigns are reliable should arbitrary player inspiration routinely invoke original theme translation, queued custom art, and optional synthesized narration.

## Ownership

### RPG GM Runtime owns

- campaign semantics, hidden incident packages, committed truth, evidence relationships, scene intent, NPC motives, memory, dialogue content, and consequences;
- incident-pool selection, validation, seeding, and model realization;
- freeform player-intent interpretation;
- party, relationship, quest, and runtime-owned world continuity;
- requests for checks, choices, encounters, media intents, and narration intents;
- model orchestration and deterministic fallback.

### GameFrame owns

- the complete player interface;
- the Monster Master theme and asset pack;
- authenticated commands and player-scoped projections;
- prevention of runtime-only incident fields leaking into player views;
- structured campaign mechanics deliberately promoted into GameFrame;
- Arena Battles mechanics, tactical replay, and committed outcomes;
- asset selection, composition, storage, delivery, and optional generation;
- narration playback and text fallback.

## Testing role

Monster Master RPG is the canonical end-to-end fixture for cross-repository integration.

The fixture must remain:

- deterministic when live models and providers are disabled;
- pinned to a versioned incident package and seed for reproducible evidence;
- bounded enough for ordinary GitHub-hosted integration checks;
- rich enough to cover public, party-private, player-private, and runtime-only information;
- capable of proving that hidden incident truth does not leak through projections or recaps;
- capable of entering the actual GameFrame tactical implementation;
- replayable after process restart and Durable Object eviction;
- independent of Tailscale and operator-local services.

Separate variable-seed journeys should prove package diversity without replacing the deterministic canonical fixture.

The reference fixture may evolve through versioned additions. Existing accepted fixtures must not be silently rewritten in ways that make older integration evidence ambiguous.

## Expansion gate

The platform should not prioritize arbitrary setting generation over the following proof:

1. a complete Monster Master starter expedition runs against prepared assets;
2. the GM commits and preserves a coherent hidden incident package;
3. the GM maintains semantic continuity through multiple scenes without rewriting the mystery;
4. the actual GameFrame tactical implementation accepts the encounter and returns a structured outcome;
5. the campaign applies the outcome and resumes;
6. two players receive correct audience-scoped information while runtime-only truth remains hidden;
7. exact retries, disconnect, process restart, and later resume do not duplicate, lose, or mutate campaign truth;
8. a new seed produces a materially different but still valid starter incident;
9. presentation remains coherent without live media generation.

After this gate, theme-on-demand work becomes an expansion of a proven platform rather than a substitute for one.

## Non-goals

The reference campaign does not require:

- one final canonical starter mystery that every group must replay;
- the final Monster Master story, world size, creature roster, or balance;
- immediate renaming of every internal identifier;
- an open world before the compact chapter works;
- unrestricted model invention without a committed incident package;
- live generated art for routine play;
- premium narration or distinct voices for every character;
- every creature-collection or survival mechanic associated with other commercial games;
- copying protected characters, creatures, settings, terminology, designs, or storylines.

## Governing rule

> Prove the Game Master with a replayable Monster Master starter chassis, prepared assets, committed hidden incident truth, and the real Arena Battles tactical path; expand into arbitrary generated themes only after that complete campaign loop is reliable.
