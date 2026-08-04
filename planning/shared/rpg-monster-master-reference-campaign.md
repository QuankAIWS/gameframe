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
shared_document_version: 1
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

The first reference campaign should be intentionally small but structurally complete.

Minimum content:

- one starting settlement or academy;
- one nearby route or wilderness area;
- two player characters and a bounded starter creature roster;
- one mentor, one recurring rival, and one local antagonist or faction;
- two or three linked scenes before the first battle;
- one public clue and one correctly scoped player-private clue;
- one freeform social or investigative action;
- one deterministic noncombat check and visible consequence;
- one bounded choice with a persistent campaign effect;
- one Arena Battles tactical encounter;
- structured survivors, injuries, rewards, objectives, and relationship consequences;
- a return scene, recap, disconnect, restart, and later-session resume.

The campaign may use a scripted or deterministic Game Master implementation first. Model-backed improvisation is added only after authoritative campaign state, commands, projections, and encounter round trips are proven.

## Platform proving order

### Stage 1 — Fixed campaign and fixed assets

Use a deterministic Monster Master chapter, prepared theme pack, and mock or scripted GM. Prove campaign commands, audience projections, persistence, reconnect, and tactical handoff.

### Stage 2 — Model-directed Monster Master campaign

Replace scripted decisions with bounded RPG GM Runtime proposals while retaining the same prepared content and asset pack. Evaluate continuity, pacing, NPC behavior, intent interpretation, checks, and consequences without changing the presentation substrate.

### Stage 3 — Variable Monster Master campaigns

Allow the GM to assemble different Monster Master chapters, locations, opponents, quests, and encounter configurations from approved content definitions and the bespoke asset catalog.

### Stage 4 — Additional curated themes

Prove at least one materially different prepared theme pack using the same campaign contracts and presentation primitives.

### Stage 5 — Theme-on-demand generation

Only after the prepared campaigns are reliable should arbitrary player inspiration routinely invoke original theme translation, queued custom art, and optional synthesized narration.

## Ownership

### RPG GM Runtime owns

- campaign semantics, scene intent, NPC motives, memory, dialogue content, and consequences;
- freeform player-intent interpretation;
- party, relationship, quest, and runtime-owned world continuity;
- requests for checks, choices, encounters, media intents, and narration intents;
- model orchestration and deterministic fallback.

### GameFrame owns

- the complete player interface;
- the Monster Master theme and asset pack;
- authenticated commands and player-scoped projections;
- structured campaign mechanics deliberately promoted into GameFrame;
- Arena Battles mechanics, tactical replay, and committed outcomes;
- asset selection, composition, storage, delivery, and optional generation;
- narration playback and text fallback.

## Testing role

Monster Master RPG is the canonical end-to-end fixture for cross-repository integration.

The fixture must remain:

- deterministic when live models and providers are disabled;
- bounded enough for ordinary GitHub-hosted integration checks;
- rich enough to cover public, party-private, player-private, and runtime-only information;
- capable of entering the actual GameFrame tactical implementation;
- replayable after process restart and Durable Object eviction;
- independent of Tailscale and operator-local services.

The reference fixture may evolve through versioned additions. Existing accepted fixtures must not be silently rewritten in ways that make older integration evidence ambiguous.

## Expansion gate

The platform should not prioritize arbitrary setting generation over the following proof:

1. a complete Monster Master campaign chapter runs against prepared assets;
2. the GM maintains semantic continuity through multiple scenes;
3. the actual GameFrame tactical implementation accepts the encounter and returns a structured outcome;
4. the campaign applies the outcome and resumes;
5. two players receive correct audience-scoped information;
6. exact retries, disconnect, process restart, and later resume do not duplicate or lose campaign truth;
7. presentation remains coherent without live media generation.

After this gate, theme-on-demand work becomes an expansion of a proven platform rather than a substitute for one.

## Non-goals

The reference campaign does not require:

- the final Monster Master story, world size, creature roster, or balance;
- immediate renaming of every internal identifier;
- an open world before the compact chapter works;
- live generated art for routine play;
- premium narration or distinct voices for every character;
- every creature-collection or survival mechanic associated with other commercial games;
- copying protected characters, creatures, settings, terminology, designs, or storylines.

## Governing rule

> Prove the Game Master with Monster Master RPG, a prepared asset pack, and the real Arena Battles tactical path; expand into arbitrary generated themes only after that complete campaign loop is reliable.