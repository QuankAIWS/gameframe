---
title: RPG Scene, Entity, and Observer Knowledge Contract
status: accepted
document_type: architecture-contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GameFrame RPG
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-scene-entity-and-knowledge-contract-v1
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-scene-entity-and-knowledge-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-scene-entity-and-knowledge-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Scene, Entity, and Observer Knowledge Contract

## Decision

The RPG platform promotes **durable entities**, **authoritative semantic scene membership**, **stable GameFrame scene materialization identity**, and **sparse observer-specific knowledge** into first-class concepts.

The committed CampaignPackage remains immutable authored truth. The campaign journal remains authoritative semantic history. Entity/scene/knowledge systems are deterministic projections/services over those authorities; they do not become another campaign database or another agent.

GameFrame owns playable materialization and deterministic physical/tactical mechanics. RPG GM Runtime owns semantic world meaning, hidden truth, and durable campaign consequences. The two authority domains meet through explicit versioned contracts.

The system must answer exact questions without relying on model prose:

- who exists;
- who is physically present in which semantic scene;
- which accepted materialization represents that scene/location for this campaign;
- what important objects/exits/hazards/state remain;
- what each player/NPC observer knows or believes;
- what identity label a viewer may use;
- which principal controls which character/entity under the active ruleset;
- whether a scene is in exploration/tactical/transition control state;
- what deterministic tactical consequences changed the same world.

## Architecture

```text
committed CampaignPackage + WorldGraph
            +
durable campaign journal
            ↓
Entity Registry + Scene Registry + Observer Knowledge
            ↓
semantic Runtime World Projection
            ↕
GameFrame RPG Engine materialized scene
            ↓
exploration / interaction / Tactical Activation
```

Campaign combat does not create a second semantic scene merely because tactical rules activate.

## 1. Durable entity identity

Every person, trainer/player-character, monster/creature, companion, and campaign-relevant object that may persist across scenes receives a stable semantic entity identity.

A durable entity record may include:

- stable entity ID;
- entity kind;
- canonical runtime identity;
- player-safe descriptors;
- role/affiliations;
- ruleset profile references;
- relationships/conditions;
- private facts/visibility policy;
- semantic presentation identity;
- provenance: package-authored, campaign-created, imported, or promoted incidental.

Stable identity never implies every observer knows the canonical name, role, secret, or existence.

## 2. Character Factory

Dungeon Master does not directly mint durable incidental people through unconstrained prose.

A bounded request such as:

```text
role: roadside-mechanic
location: checkpoint-district
constraints: local adult civilian
mode: immediate-scene
```

passes through deterministic/schema-first Character Factory rules.

Character Factory may create ordinary incidental people. It may not silently create/replace:

- a committed culprit;
- decisive witness;
- required clue owner;
- secret authority;
- package-invariant relationship;
- another package-bearing function unless that role was intentionally open.

## 3. Incidental materialization transaction

Immediate incidental creation should be one idempotent semantic result:

```text
validated request
→ stable entity creation
→ semantic scene admission
→ initial justified observer awareness
→ durable commit
→ entity may be portrayed/materialized
```

A crash/retry must not create duplicates, orphaned scene membership, or unintended knowledge.

Off-screen/deferred creation must state that intent explicitly and does not imply scene admission.

## 4. Promotion of incidental entities

An incidental entity becomes durably recurring whenever continuity matters, including promises, debts, injury, insult, favor, custody, employment, rivalry, witnessed campaign facts, tasks, or repeated interaction.

Promotion preserves the same entity ID and presentation continuity. Bespoke art is optional.

## 5. Semantic Scene Registry

RPG GM Runtime maintains **zero or more active semantic scenes**.

A first durable scene model contains concepts equivalent to:

```text
SceneState
  sceneId
  locationId
  semanticRevision
  membership[]
  sceneLocalObjects[]
  hazards[]
  environmentalFeatures[]
  exits[]
  materializationRef?
  lifecycleState
```

`membership[]` is the single authoritative collection for persistent physical presence. Read models may group people/creatures for convenience but must not create competing presence stores.

Each membership record may include:

- entity ID;
- scene role/presence state;
- entry provenance;
- current semantic disposition;
- ruleset/tactical relevance where appropriate.

An absent entity cannot physically act in the scene unless an explicit remote-communication/remote-action mechanic authorizes it.

## 6. GameFrame scene materialization

A semantic scene/location may be represented by one accepted GameFrame materialization for a campaign instance/version.

GameFrame-owned materialization state may include:

- materialization ID/version/hash;
- scene/location linkage;
- deterministic/seed provenance;
- collision/navigation geometry;
- semantic anchor positions;
- entry/exit/transition zones;
- interactive-object bindings;
- current deterministic entity transforms required for play/recovery;
- ruleset capability compatibility;
- asset bundle references;
- tactical-mode state where active.

Materialization is not the hidden CampaignPackage bible. It is playable GameFrame authority.

Once accepted, revisiting the scene must return to the same materialized place, subject to committed world changes, rather than rerolling a new layout without an explicit migration/regeneration lifecycle.

## 7. Semantic state versus transforms

Keep semantic presence and high-frequency transforms separate.

Runtime semantic truth may say:

```text
Orange is in scene.west-woods
Pell is in scene.west-woods
checkpoint barrier is broken
```

GameFrame realtime state may additionally know:

```text
Orange x/y/facing
Pell x/y/facing
current animation/movement state
```

Frame-by-frame transforms are not campaign journal events.

A semantic commit is appropriate when movement crosses a meaningful boundary such as scene enter/leave/transfer, item/object custody, escape destination, or another state change that matters after reconnect/restart.

## 8. Scene object and world continuity

Persistent entities use Entity Registry + semantic scene membership. Low-value decorative geometry may remain materialization-local.

Materially relevant facts must survive, including examples such as:

- cart contains particular cube cases;
- road barrier is intact/broken/moved;
- pack animal remains attached to a cart;
- important door is locked/open/destroyed;
- monster fled through west-woods exit;
- evidence was taken/damaged;
- bridge is impassable;
- named character moved to another scene.

Model description is not authority until the correct semantic/GameFrame operation commits.

## 9. Observer Knowledge

World truth and observer knowledge are separate domains.

Use sparse semantic knowledge records keyed by observer/audience + subject/fact identity as campaign behavior requires.

A knowledge record may include:

- observer entity/viewer/audience;
- subject entity/location/fact ID;
- semantic fact ID;
- state such as observed, suspected, learned, confirmed, corrected, disproven;
- provenance/source event;
- first learned/last revised positions;
- visibility scope;
- optional player-safe display material.

Do not build an eager all-observers × all-facts matrix.

Observers may include player characters, NPCs, intelligent creatures, and explicit party/table audiences when a real mechanic needs them.

## 10. Player knowledge and People projection

GameFrame receives a viewer-safe projection, not the complete Entity Registry/knowledge graph.

One durable entity may appear to a viewer as:

```text
"the woman in inspector's gear"
→ "the checkpoint inspector"
→ "Mara Venn"
```

The entity ID remains constant.

A People projection may contain:

```text
entityId
displayIdentity
knownRole?
knownFacts[]
relationship?
firstMet?
lastSeen?
currentPresence?
portraitOrFallback?
```

Display strings are derived presentation material, not the authoritative knowledge database.

Unknown entity existence is omitted when required; hidden canonical names/IDs/counts must not leak through placeholders.

## 11. NPC observer knowledge and performance custody

Entity-performance context uses the same semantic knowledge substrate.

A Pell performance context may include:

- Pell's identity/personality/goals;
- Pell's known facts/beliefs;
- relevant memories/relationships;
- Pell's current scene observations;
- conditions/resources relevant to portrayal;
- bounded recent conversation.

It must not include unrelated hidden campaign facts merely because referee mode can access them.

This is a structural authorization/context-compiler boundary, not a prompt courtesy.

## 12. Dungeon Master Context Compiler

Dungeon Master should consume typed current state rather than a raw journal excerpt as primary memory.

Context is compiled according to mode.

### Referee/world mode

May receive:

- relevant immutable package invariants;
- relevant WorldGraph/location state;
- current semantic scenes/entities;
- objectives/events/pressure;
- hidden causality required for adjudication;
- relevant observer knowledge;
- unresolved mechanics;
- bounded recent narrative;
- current trigger.

### Entity-performance mode

Receives the bound entity's authorized perspective plus only package constraints required to portray safely/consistently.

### Ask-GM mode

Receives committed rules and player-authorized knowledge needed to answer without exposing hidden truth.

### Render context

Player-facing prose/presentation receives viewer-safe projections only after semantic validation/commitment.

## 13. Player action versus GM query

GameFrame must distinguish:

- **Interact/Talk** — targeted in-fiction action;
- **Do Something Else** — arbitrary plausible in-fiction/freeform action;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification query.

Ask-GM does not automatically become speech, advance time, or make NPCs hear the request.

Ask-GM request/response is player-private by default unless an explicit broader audience is chosen.

## 14. Presentation origin and audience

Origin and audience are separate.

Useful origins include:

- player;
- dungeon-master;
- entity;
- system;
- deterministic-mechanic/tactical mode.

An entity-origin event references stable identity internally but renders the viewer-authorized label.

## 15. WorldGraph and scene transfer

WorldGraph declares semantic location/route relationships. Scene Registry declares current presence. GameFrame materializes playable geometry.

A party or entity moves between semantic scenes through explicit validated transfer semantics.

The first multiplayer product may require a cohesive party transition zone before the whole party transfers. This is a product rule over a zero-or-more-scene architecture, not a data-model limitation.

## 16. Same-map Tactical Activation

Campaign combat does not perform scene → separate Arena → scene reconciliation.

Instead, GameFrame enters tactical authority over the **current materialized scene**.

A Tactical Activation validates a snapshot including as applicable:

- semantic scene ID/revision;
- materialization ID/version;
- current tactically relevant positions/facing;
- participant/entity IDs;
- roles/factions/teams;
- controller/control authority;
- health/resources/conditions;
- RPG Ruleset/profile/version;
- existing map collision/navigation geometry;
- relevant objects/barriers/hazards/exits;
- objectives/alternate terminal conditions.

If semantic/mechanical state changes incompatibly during activation custody, the activation must reject/retry/reconcile rather than silently start from stale truth.

Once active:

```text
same scene
  resolutionMode = tactical
  initiative/turn/action authority active
```

The player's current physical positions are starting positions unless an explicit supported rule says otherwise.

## 17. Tactical participant representation

Current semantic scene membership does not mean every entity must receive a full tactical action set.

Bounded roles may include:

- allied combatant;
- hostile combatant;
- neutral;
- noncombatant;
- protected entity;
- escaping entity;
- support entity;
- objective/environmental entity.

Important persistent entities do not silently disappear merely because they lack a legacy duel-unit profile.

An entity may be excluded from tactical processing only when its presence is genuinely mechanically irrelevant or an explicit semantic transition establishes that it left before activation.

## 18. Ruleset-defined control authority

The generic engine does not assume one principal controls exactly one tactical unit.

A ruleset may authorize one player principal to control:

- their player-character entity;
- one or more companions/monsters;
- shared/temporary entities under explicit rules.

Monster Master specifically must support a Master/trainer plus class/ruleset-defined deployed monster control without hardcoding a universal one-monster limit into GameFrame RPG Engine.

Client-supplied IDs never create authority by themselves.

## 19. Tactical outcomes and return to exploration

Structured tactical state/outcomes may include:

- active;
- incapacitated;
- withdrew;
- fled;
- surrendered;
- recalled;
- dead only under explicit lethal rules;
- health/resource/condition changes;
- object custody/damage;
- objective state;
- exit/destination consequences.

These changes apply to the same entities/world.

After required deterministic/semantic consequences commit:

```text
resolutionMode: tactical
→ exploration
```

The player remains on the same materialized map. There is no campaign-only Return-to-Campaign navigation step.

## 20. Standalone Battle Arena relationship

Monster Master Battle Arena is a separate standalone product that establishes a scene through BattleScenario/map setup before entering tactical play.

It should converge on the same Monster Master tactical rules/control semantics as campaign tactical mode.

The Arena product is not a hidden campaign mode and must not be used as a substitute battlefield for an already materialized campaign scene.

## 21. Multi-scene/split-party semantics

Multiple active semantic scenes require each player/entity to have explicit scene assignment.

Scene-local observation, audibility, realtime subscriptions, events, and tactical mode are scoped accordingly.

Party membership does not imply shared sensory knowledge.

One scene may eventually be tactical while another remains exploratory, but this requires explicit product semantics for:

- campaign/global time;
- concurrent Dungeon Master/entity turns;
- global event pressure;
- cross-scene communication;
- overlapping consequences;
- recovery/reconnect;
- scene-local tactical custody.

Therefore the architecture supports zero-or-more scenes now while first productizing one active party scene.

## 22. Repository authority

### RPG GM Runtime owns

- CampaignPackage/WorldGraph semantic truth;
- campaign journal;
- Entity Registry/Character Factory;
- semantic Scene Registry;
- Observer Knowledge/People derivation;
- Dungeon Master context compilation/semantic decisions;
- semantic tactical-activation reasons/objectives;
- mapping deterministic mechanic results into campaign consequences where required.

### GameFrame owns

- scene materialization identity/geometry/assets;
- realtime transforms/session state;
- authenticated player/control authority;
- direct interaction surface;
- deterministic mechanics;
- tactical mode/initiative/legal actions/outcomes;
- player-safe rendered UI/projections;
- standalone Battle Arena setup/lifecycle.

Neither repository reads the other's private database.

## 23. Required first fixtures/tests

Add/prove progressively:

- package actor → stable entity registry;
- incidental creation/admission/revisit;
- semantic scene enter/leave/transfer/restart;
- materialization identity/revisit;
- viewer descriptor→role→name progression;
- NPC observer knowledge divergence;
- Pell context secret-exclusion proof;
- direct Interact/Talk;
- Ask-GM versus Do Something Else;
- principal/player-character/controlled-entity authorization;
- same-map Tactical Activation using current positions;
- no replacement battlefield/Return-to-Campaign lifecycle;
- escape/withdrawal/other terminal state as implemented;
- tactical consequences → same-scene exploration resume;
- two-player one-scene behavior before split-party acceptance.

## Governing rule

> Runtime owns durable semantic identity, presence, and observer knowledge; GameFrame owns the playable materialization and deterministic control state. Tactical combat changes the rules applied to the current scene, not the scene itself.
