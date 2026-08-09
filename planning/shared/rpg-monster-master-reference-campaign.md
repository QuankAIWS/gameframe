---
title: Monster Master RPG Reference Campaign
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master product family
shared_document_id: rpg-monster-master-reference-campaign-v1
shared_document_version: 7
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-monster-master-reference-campaign.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-monster-master-reference-campaign.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-campaign-architect-contract.md
  - rpg-event-and-plot-pool-contract.md
---

# Monster Master RPG Reference Campaign

## Decision

Monster Master is the first handcrafted campaign for the reusable RPG platform and the gold standard for future Campaign Architect output.

The product family is:

- **Monster Master RPG** — embodied campaign using GameFrame RPG Engine + Monster Master Ruleset/family content + committed CampaignPackage;
- **Monster Master Arena Battles** — standalone Battle Simulator entry using shared Monster Master rules/content;
- **RPG platform** — reusable CampaignPackage/Dungeon Master/world/materialization/ruleset architecture proven by the campaign.

Campaign combat does not launch Arena Battles. It uses same-map Tactical Activation.

## Gold-standard purpose

The manually authored package should prove what a later Campaign Architect must be able to create:

- coherent premise/tone/player role;
- hidden truth/causality and continuity invariants;
- actors/goals/secrets/relationships/limits;
- locations/WorldGraph/routes;
- opening/initial scene/observer knowledge;
- clue/event/objective/escalation/resolution structure;
- deterministic mechanics/tactical thresholds;
- semantic materialization/media requirements;
- recovery/provenance/versioning.

The package is a world specification, not a model transcript or scripted menu tree.

## Current first chapter — Crooked Checkpoint

Crooked Checkpoint is the first embodied reference scene. Deployed staging now proves the scene can be materialized and walked on desktop/mobile with durable physical recovery.

The current next proof is interaction/TALK, followed by persistent CHANGE, West Woods TRAVEL, same-map FIGHT, and complete PROVE.

## Opening presentation rule

The opening should establish the place and immediate pressure, then hand control to the player.

- Warden Pell is known because he is the assigned guide.
- Other checkpoint figures use observer-authorized descriptors/roles until introduced/learned.
- Suspicious details should invite investigation without forcing a repeated two/four-option text-adventure funnel.
- Suggested approaches may exist as optional help but are never the complete action space.
- The world itself—Pell, official(s), cart, barrier, signs/paperwork, animals, terrain, route mouths—should provide the choices once play begins.

## Capture-cube/cart correction

Ordinary capture cubes are small handheld external devices with larger private interior living spaces.

Therefore an ordinary cube must **not** be described as physically making a full cart jump/buck/shake merely because its occupant moves inside the private cube interior.

The confiscation cart may remain important and may carry cube cases/racks, evidence, equipment, or other cargo. If physical disturbance is needed, author an explicit physical source such as specialist containment, a person/creature physically inside/on the cart, shifting cargo, impact/sabotage, or another credible mechanism.

Suspicion may instead come from guarded custody, mismatched seals/paperwork, nervous handlers/animals, unauthorized procedure, unusual routing, or other observable inconsistencies.

## Dungeon Master boundary

The Dungeon Master may generate/adapt narration, dialogue, descriptions, mannerisms, clue wording, local reactions, secondary complications, optional leads, unusual-intent adjudication, and bounded package-compatible connective detail.

It may not overwrite package truth, mint authoritative success through prose, reveal hidden canonical names, replace established culprits/evidence, contradict scene presence/Observer Knowledge, or make suggested actions the complete action space.

Consequential model output remains a proposal until validated/committed through semantic or deterministic authority.

## Interaction model

The first chapter should prove:

- direct nearby target selection;
- Pell Talk via Pell-scoped entity-performance context;
- Ask Game Master as separate out-of-fiction communication;
- Do Something Else as arbitrary plausible in-fiction intent;
- explicit origin/audience/audibility rather than one global transcript.

Normal speech may be heard by nearby observers. A whisper may deliberately restrict who hears it. Private Ask-GM is not fictional speech.

## Freeform-world parity

A common action may have a dedicated control, but the player should also be able to express equivalent intent naturally.

Example:

```text
"I pull out Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate ownership/deployment rules/current state
→ commit accepted semantic + physical deployment
→ GameFrame renders Cinder
→ narration/history reports accepted result
```

The sentence is an attempt, not a state write.

## Campaign Chronicle role

The campaign feed should mature into an observer-authorized chronicle retaining meaningful opening/scene narration, heard dialogue, discoveries, consequential actions, deterministic outcomes, persistent changes, travel, and relevant GM interventions/rulings.

It should not become a tiny combat log, but it should also stop being the primary control surface as embodied play matures.

Different players may legitimately have different chronicle content based on scene presence, audibility, Observer Knowledge, whispers, and private GM communication.

## Same-map tactical proof

When tactical pressure becomes sufficient:

```text
current campaign scene
→ validate Tactical Activation
→ same scene enters tactical authority
→ current positions/entities/objects/exits/geometry remain
→ deterministic tactical resolution
→ semantic consequences reconcile
→ same scene resumes exploration
```

Not every present entity must become an active combatant, but materially relevant scene truth must not disappear because standalone Arena has a smaller fixed duel vocabulary.

## Current proving sequence

```text
CampaignPackage v5 / semantic substrate       complete bounded
Crooked Checkpoint semantic bootstrap         complete bounded
Crooked Checkpoint physical SEE               complete
MOVE + mobile                                complete
TALK / Pell context + interaction             active next
CHANGE / real persistent world action
TRAVEL / West Woods round trip
FIGHT / same-map Tactical Activation
PROVE / complete single-player restart path
```

Then: two-human one-scene → second materially different handcrafted Game Family → Campaign Architect → broader dynamic generated RPG/Battle Pack systems.

## Testing role

Monster Master remains the principal end-to-end campaign fixture. Evidence must separately cover:

- package validation/commit/reload;
- durable identity/scene/Observer Knowledge;
- hidden-name/secret safety;
- physical materialization/movement/recovery;
- Pell context custody;
- speech audience/audibility;
- Ask-GM vs in-fiction interaction;
- freeform intent → authoritative world change;
- West Woods transfer/revisit;
- same-map Tactical Activation/outcomes;
- complete restart/resume;
- live provider and deployed staging;
- later second handcrafted family.

A canned opening, transport round trip, or standalone Arena result does not prove the campaign.

## Ownership

### RPG GM Runtime

Owns package/world/hidden truth, Entity/Scene/Observer Knowledge authorities, Dungeon Master context/orchestration, freeform interpretation, semantic consequences/transfer, and Tactical Activation semantic requirements/reconciliation.

### GameFrame

Owns authenticated player UI, physical materialization/x-y/collision/interaction range, contextual controls, deterministic rules/control/tactical state, observer-safe world/history presentation, and standalone Battle Simulator.

## Governing rule

> Handcraft one truthful Monster Master world, let the player inhabit and act in it directly, keep arbitrary plausible intent available, keep characters bounded to what they know, and use one durable semantic/game state as the source for both what the world shows now and what the campaign chronicle remembers later.
