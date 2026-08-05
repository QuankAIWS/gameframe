---
title: Monster Master RPG Canonical Baseline
status: accepted
document_type: authority-index
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master RPG
  - Monster Master: Arena Battles
  - Scribbles GameFrame
  - RPG GM Runtime
related:
  - rpg-documentation-index.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rpg-asset-register.md
  - monster-master-rpg-npc-pool.md
  - shared/rpg-campaign-compiler-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-one-shot-intro-agent-contract.md
  - shared/rpg-monster-master-reference-campaign.md
---

# Monster Master RPG Canonical Baseline

## Purpose

This is the required starting point for RPG and Monster Master work. It reconciles the current documents and defines which source controls when older wording, sample fixtures, implementation branches, or narrow work orders differ.

## Controlling architecture

Monster Master RPG uses two distinct runtime responsibilities.

### Campaign compiler / plot agent

The compiler creates or selects a validated campaign package before ordinary play. The package commits:

- campaign premise and functional spine;
- hidden truth and causal history;
- important actors, motives, secrets, and limits;
- clue and evidence relationships;
- event pools, eligibility, escalation, and consequences;
- tactical thresholds and objective envelopes;
- presentation semantics and asset-role intents;
- forbidden retcons, package version, seed, and provenance.

The package is authoritative campaign truth. It is not an ordered scene script.

### Live DM agent

The live DM consumes the committed package and current campaign journal. It owns:

- narration, dialogue, pacing, and NPC performance;
- interpretation of freeform player action;
- state-compatible event selection;
- checks, choices, consequences, and incidental detail;
- creation of plausible incidental NPCs with stable continuity;
- tactical encounter requests and aftermath narration.

The DM may adapt strongly but may not replace the selected family, cause, responsible actors, decisive evidence, established facts, or committed tactical outcomes. It must not treat suggestions as the full action space.

There is one live-DM execution path. Prepared-campaign intro behavior must feed the ordinary model-backed GM planner through committed package context rather than creating a second independent DM runtime.

## Repository ownership

### GameFrame owns

- public and shared RPG contracts;
- player-facing interfaces and audience projections;
- Monster Master lore and current creative direction;
- semantic asset roles, registries, manifests, fallbacks, and rendering;
- Arena Battles rules, legal actions, persistence, replay, and terminal outcomes;
- campaign-to-battle and battle-to-campaign presentation.

### RPG GM Runtime owns

- private plot-family and NPC catalogs;
- selected and committed campaign packages;
- hidden causes, actor secrets, clue answers, and event eligibility;
- runtime prompts, model orchestration, continuity, and campaign journal state;
- incidental NPC instances, memories, relationships, and private hooks.

Shared documents are canonical in GameFrame and mirrored byte-for-byte into RPG GM Runtime only after the GameFrame change merges.

## Document authority order

Read and apply the documents in this order:

1. this canonical baseline;
2. `monster-master-rpg-current-creative-direction.md` for current product, tone, agency, and production direction;
3. `monster-master-rpg-lore-and-story.md` for accepted world and rules-lore decisions;
4. shared campaign compiler, event/plot, intro-agent, reference-campaign, rendering, integration-testing, and deployment contracts;
5. `monster-master-rpg-asset-register.md` and its machine-readable catalogs for asset coverage and production sequence;
6. `monster-master-rpg-npc-pool.md` and the NPC role catalog for prepared and incidental people;
7. implementation plans and work orders only when they remain compatible with the sources above.

## Reconciled decisions

### Tone

Monster Master is an adult fantasy-adventure setting with broad range: dry humor, situational comedy, slapstick, absurd professional culture, selective meme-adjacent concepts, sincere relationships, tactical danger, funny horror, and bounded genuine horror.

Older wording that describes comedy as primarily dry or broadly cautions against slapstick is superseded. The restriction is against constant gag density, empty reference spam, corporate-training dialogue, forced wholesomeness, forced criminality, and comedy that destroys continuity or stakes.

### Player agency

Heroic and lawful play is valid and rewarding but not mandatory. Practical, selfish, opportunistic, illegal, reckless, avoidant, and unexpected actions are permitted when the fiction supports them. Consequences arise from the world, not an invisible morality lesson.

### Starter structure

The certification circuit is a reusable chassis, not a canonical incident or mandatory scene order. The private runtime catalog contains several materially different plot families. One package is selected and committed per run before meaningful investigation.

A deterministic package is a test fixture only. It does not control product canon, default campaign copy, lore priority, NPC planning, or the asset roadmap.

### NPCs

Prepared NPC roles provide recurring anchors and reusable asset coverage. The cast is not closed. The DM may create plausible incidental people, assign stable IDs and visual families, preserve continuity, and promote them when play makes them important. An incidental NPC cannot retroactively become a committed culprit, decisive witness, clue owner, or secret authority unless the package explicitly left that role open.

### Monster Master identity

The Master is a human trainer/player character. Trainers and monsters are separate rules and asset families. Compatibility-era identifiers such as `warden-master-v1` do not define a monster species.

### Asset authority

The product-wide asset register controls coverage, priority, and lifecycle. The core pack controls runtime pack identities, source-master requirements, deterministic derivatives, and compatibility fallbacks. Registry IDs, semantic role IDs, continuity IDs, rules content IDs, and runtime derivative IDs are distinct layers and must be explicitly mapped rather than treated as interchangeable names.

The current production sequence is cross-family: terrain, props, trainers, monsters, interface, scenes, effects, and fallbacks. Earlier NPC-first style-lock work orders are superseded.

## Current implementation sequence

1. keep this GameFrame document set canonical and synchronize shared mirrors into runtime;
2. retain the private plot and NPC catalogs without importing hidden truth into GameFrame;
3. commit selected package truth into the durable runtime journal;
4. feed that truth into the existing model-backed GM planner;
5. add scripted multi-turn campaign simulations with mock players and mock model output;
6. bind runtime-authored tactical requests to durable Arena Battles encounters;
7. prove outcome application, restart, reconnect, retry, and resume;
8. expand assets and additional plot families only after the complete loop works.

## Required campaign test harness

The first serious GM acceptance harness must:

- run at least two materially different selected packages;
- use scripted players across multiple turns;
- include expected, chaotic, avoidant, and early-correct-guess behavior;
- create and revisit an incidental NPC;
- test missed clues and recovery paths;
- assert that committed truth never changes;
- assert that runtime-only information never leaks;
- preserve NPC identity, promises, injuries, debts, and relationships;
- reach at least one tactical handoff and apply a structured outcome;
- restart and resume without duplication or continuity loss.

## Superseded material

Do not follow:

- any document or work order that makes one incident the canonical starter;
- any deterministic fixture as creative authority;
- the older dry-comedy/no-slapstick wording;
- NPC-first asset sequencing;
- a standalone Monster Master intro agent that bypasses the ordinary live-GM planner;
- runtime-authored or Cloudflare-managed asset generation as a current dependency;
- Hyperbolic Time Cube or confirmed Class Five material in the starter.

## Governing rule

> Compile or select one durable campaign truth, let one live DM adapt it around real player action, keep GameFrame authoritative for presentation and combat, and never allow a sample fixture, stale branch, or narrow work order to become the product architecture.
