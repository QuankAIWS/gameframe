---
title: RPG Scene, Entity, and Observer Knowledge Contract
status: accepted
document_type: architecture-contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-scene-entity-and-knowledge-contract-v1
shared_document_version: 3
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

The RPG platform promotes **durable entities**, **authoritative semantic scene membership**, **stable materialized-scene identity**, and **sparse observer-specific knowledge** into first-class concepts.

The campaign journal remains authoritative history. The committed CampaignPackage remains immutable authored truth. Entity/scene/knowledge surfaces are deterministic projections/services over those authorities; they do not create a second campaign database or a third campaign agent.

GameFrame owns accepted playable materialization of semantic scenes. Materialized geometry is not hidden campaign truth, while runtime semantic scene truth is not browser-local geometry.

The purpose is to prevent models and presentation from being used as implicit memory for questions the software can answer exactly:

- who exists;
- who is physically present and in which semantic scene;
- which accepted materialized scene represents that location for this campaign;
- what a person/creature is called by a particular viewer;
- what a player character or NPC observer actually knows/believes;
- what relevant objects, exits, hazards, and world changes remain in a scene;
- which entities/objectives must survive exploration-to-Arena handoff and back.

## Architecture

```text
committed CampaignPackage
        +
durable campaign journal
        ↓
Entity Registry + Scene Registry + semantic world/location state
        ↓
Observer Knowledge Graph / player-safe projections
        ↓
Dungeon Master Context Compiler
        ↘
         GameFrame semantic scene projection
                 ↓
        accepted exploration materialization
```

When tactical authority is needed:

```text
authoritative semantic source scene + scene revision/digest
        ↓
Encounter Scene Compiler
        ↓
validated encounter-scene projection
        ↓
GameFrame tactical materialization
        ↓
authoritative structured terminal outcome
        ↓
runtime scene/world reconciliation
        ↓
GameFrame exploration materialization update
```

## 1. Durable entity identity

Every person, trainer, monster, important creature, and campaign-relevant object that may persist across scenes receives a stable semantic entity identity.

A durable entity record may include:

- stable entity ID;
- entity kind;
- canonical runtime identity;
- public/player-safe descriptors;
- appearance identity/fallback;
- role and affiliations;
- competencies and rules profiles;
- relationships and durable conditions;
- private facts and visibility policy;
- presentation identity;
- provenance: package-authored, campaign-created, imported, or promoted incidental entity.

Stable identity does not imply that every observer knows the entity's canonical name, role, secrets, or existence.

## 2. Character Factory

The Dungeon Master does not directly mint durable incidental character records by freeform prose.

When live play requires a plausible unprepared person, the Dungeon Master may submit a bounded semantic request containing role/location/constraints/provenance/materialization mode.

A runtime Character Factory materializes the durable incidental entity from validated rules and prepared role vocabularies.

The Character Factory is runtime substrate, not a third campaign agent. The default implementation should be deterministic/schema-first. A later provider may enrich allowed cosmetic/characterization fields, but validation and durable identity remain runtime-owned.

The Character Factory may create ordinary incidental people. It may not silently create/replace a committed culprit, decisive witness, required clue owner, secret authority, package-invariant relationship, or another package-bearing function already fixed by the CampaignPackage.

## 3. Incidental materialization transaction

When a new incidental person first appears in active play, durable creation must not be split into loosely related side effects.

Conceptually:

```text
validated incidental-person request
→ materialize stable entity
→ admit entity to authoritative semantic scene
→ establish only justified initial observer awareness
→ commit one idempotent semantic result
→ Dungeon Master may portray the committed entity
```

A crash/retry must not create an entity without intended scene admission, duplicate the person, or reveal more identity than the committed awareness state permits.

If a person is materialized for later/off-screen use, that mode is explicit and no scene admission is implied.

## 4. Promotion of incidental entities

An incidental entity becomes durable/recurring when continuity matters, including when players:

- seek that person again;
- create a promise, debt, payment, injury, insult, favor, suspicion, employment, custody, rivalry, or relationship;
- assign them a task;
- cause them to witness or learn campaign-relevant facts;
- bring them into later travel/scenes.

Promotion preserves the same entity ID and presentation identity. It does not regenerate a replacement person.

Unique art is not required for promotion; GameFrame may retain a prepared portrait/sprite family, silhouette, or card until better presentation deliberately supersedes it.

## 5. Authoritative Scene Registry

The runtime maintains **zero or more active semantic scenes** rather than assuming the campaign always has one universal current scene.

A player-facing projection normally exposes the scene occupied by that player's character.

A durable semantic scene has at least:

```text
SceneStateV1
  sceneId
  locationId
  membership[]
  sceneLocalObjects[]
  hazards[]
  environmentalFeatures[]
  exits[]
  materializationRef?
  startedAt
  revision
  state
```

`membership[]` is the single authoritative physical-presence collection for persistent entities. Entity kind comes from Entity Registry. Player projections may split membership into `presentPeople`, `presentCreatures`, and other convenient read models.

Each membership record includes at least:

- entity ID;
- scene role;
- presence state;
- entry provenance;
- current disposition where relevant;
- tactical eligibility/role when applicable.

The registry owns open/close, enter/leave/transfer, remote-contact, and scene lifecycle semantics.

A character may physically act/speak as present in a scene only when scene membership admits that character, unless an explicit remote-communication relationship is active.

Party membership does not imply physical co-presence if later split-party play is enabled.

## 6. Semantic world location versus materialized scene

Keep semantic location/scene authority separate from GameFrame playable realization.

Runtime semantic truth may know:

- checkpoint is east of the woods;
- a bridge is destroyed;
- west woods are traversable;
- Pell is present at the checkpoint;
- an entity fled via a named exit.

GameFrame materialization may know:

- collision geometry;
- semantic anchor coordinates;
- spawn/transition zones;
- interaction bindings;
- pathing/navigation representation;
- stable materialization identity/version;
- renderer asset references;
- ephemeral avatar transforms.

Runtime must not infer semantic truth from pixels/coordinates. GameFrame must not invent hidden package truth from scene layout.

A scene's `materializationRef` may point to a GameFrame-owned accepted materialization identity without importing GameFrame storage into runtime.

## 7. Materialized-scene persistence

When a semantic location is materialized into an exploration scene for a campaign, GameFrame should preserve enough accepted materialization identity/state to support revisit and reconnect.

A revisit must not silently regenerate a materially different replacement scene when continuity requires the same place.

Persist or reproducibly derive, as appropriate:

- materialization ID/version;
- materialization seed/recipe where used;
- semantic anchor bindings;
- gameplay-relevant geometry/profile;
- important interactive-object bindings;
- committed durable changes reflected from runtime truth.

Low-value cosmetic variation may be allowed only when it does not contradict identity, navigation, memory, or campaign consequences.

## 8. Scene object and creature continuity

Persistent creatures/people use Entity Registry + scene membership. Scene-local geometry or low-value ephemeral material may remain scene-local when it does not need durable cross-scene identity.

The scene/world model must preserve materially relevant facts needed for later deterministic resolution, including examples such as:

- a confiscation cart still contains particular cube cases;
- a road barrier remains closed or has been removed;
- a frightened pack animal remains attached to a cart;
- an intelligent monster escaped toward a named exit;
- a suspect left through a side road;
- a bridge or door was damaged;
- a piece of evidence was removed.

The model may describe these facts, but description does not become authority until the corresponding semantic operation is validated and committed.

## 9. Observer knowledge

World truth and observer knowledge are different domains.

The runtime should support sparse semantic knowledge keyed by observer/audience + subject + fact identity rather than storing knowledge only as accumulated prose strings.

Observers may include:

- player characters;
- NPCs;
- intelligent creatures where campaign behavior requires it;
- explicit party/table audiences;
- other bounded domain observers justified by a real mechanic.

A knowledge record may include:

- observer/viewer or audience scope;
- subject entity/location/fact ID;
- semantic fact ID;
- knowledge/belief state such as observed, suspected, learned, confirmed, corrected, disproven, believed, or remembered where useful;
- provenance/source event;
- first learned / last revised positions;
- visibility scope;
- optional safe display material.

The platform does not need an eager all-entities-by-all-observers matrix. Create sparse edges only when campaign behavior needs them.

## 10. Player Knowledge Projection

Player Knowledge Projection is a viewer-safe read model over observer knowledge and other authorized campaign state.

Knowledge may include:

- known people;
- known descriptors and names;
- known roles/affiliations;
- known relationships;
- known locations/routes;
- discovered clues/conclusions;
- known rules/license/monster/campaign facts;
- remembered conversations/promises;
- player-private discoveries.

Unknown entity existence remains omitted rather than represented by redacted IDs, empty slots, hidden counts, or `null` placeholders.

## 11. Identity and name knowledge

A canonical runtime entity name is not automatically observer-known.

For a player, the same entity may progress through:

```text
unknown descriptor → "the woman in inspector's gear"
learned role       → "the checkpoint inspector"
known name         → "Mara Venn"
```

For an NPC observer, a different label/fact set may be valid.

Player-safe rendering and character-performance context must use only knowledge authorized for that context.

This is a structural authorization boundary, not a prompt preference.

## 12. Known People projection

GameFrame receives a narrow viewer-safe People projection rather than the complete entity registry or raw knowledge graph.

A display projection may support fields similar to:

```text
KnownPersonProjectionV1
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

`knownFacts[]` is derived presentation material, not authoritative knowledge state.

Only authorized knowledge appears. The presence of an entry itself must be authorized.

## 13. NPC/entity memory and performance context

Character-performance context must not use the full hidden campaign context merely because the Dungeon Master can access it in referee mode.

For a target entity, include only relevant:

- canonical identity required internally;
- personality/behavioral constraints;
- goals/pressures;
- relationships;
- observer knowledge/beliefs/memories;
- current scene observations;
- conditions/resources;
- bounded recent conversation;
- package constraints required for correct portrayal.

Durable promises, debts, injuries, witnessed facts, learned identities, tasks, and relationships should promote into typed state when continuity matters. Transcript history alone is not persistent NPC memory authority.

## 14. Dungeon Master Context Compiler

The production Dungeon Master consumes typed current-state context rather than using a bounded raw-journal dump as primary memory.

The compiler is context-mode aware.

### Referee context may include

- immutable campaign invariants;
- relevant authoritative scene(s)/locations;
- present/relevant entity records;
- current objectives/pressure/eligible events;
- operational rosters/unresolved mechanics;
- relevant observer knowledge;
- bounded recent narrative;
- current semantic trigger.

### Entity-performance context includes

only the target entity's justified perspective plus bounded interaction context and required portrayal constraints.

### Safe rendering context

contains only information authorized for the target audience after semantic consequences/revelations commit.

The journal remains source of truth/audit trail. Typed projections are reconstructible read layers.

## 15. Player action versus player-to-GM query

GameFrame distinguishes:

- direct embodied controls/mechanics;
- targeted in-fiction interaction/dialogue;
- **Do Something Else** freeform fictional intent;
- **Ask Game Master** out-of-fiction rules/knowledge/clarification.

Ask-GM does not make NPCs hear the question or advance fictional time by default.

Do Something Else may advance/change the world if the Dungeon Master adjudicates a plausible action and validated semantic operations commit.

## 16. Presentation origin

GameFrame presentation events identify semantic origin separately from audience.

Useful origins include:

- player;
- Dungeon Master;
- entity;
- system;
- tactical encounter.

The UI may render a dedicated GM communication log and separate targeted NPC/entity conversation without conflating both simply because the Dungeon Master capability produced them.

## 17. GM intervention

A GM-origin event may include explicit presentation semantics for intensity/control behavior, such as advisory, narration, or dramatic intervention and nonblocking/pause/freeze behavior.

Presentation intensity does not itself mutate campaign truth.

## 18. Scene transition and party cohesion

A semantic scene transfer is a durable operation. Local movement inside a materialized scene normally is not.

The first embodied multiplayer posture should keep the required active party together in one shared exploration scene. A destination transition may require relevant players to gather in a transition/edge zone before one authoritative party transfer commits.

The zero-or-more-scene authority model remains available for future split-party play.

## 19. Multi-scene semantics

When players occupy separate scenes, the platform must keep distinct:

- physical presence;
- observation/knowledge acquisition;
- audibility/communication relationships;
- presentation audience;
- party membership;
- scene-local event/mechanic custody.

A player in one scene does not automatically observe another scene merely because they share a party.

Multi-scene productization requires independent realtime subscriptions, scene-scoped projections, concurrent event/DM custody, recovery, and clear cross-scene communication semantics. It is not required for the first embodied multiplayer proof.

## 20. Scene-to-Arena projection

A tactical encounter is a stricter resolution mode for the current fictional/embodied scene, not an unrelated duel.

The runtime Encounter Scene Compiler projects the subset of source-scene truth GameFrame must execute authoritatively, including:

- source scene ID;
- source scene revision/authoritative position;
- deterministic combat-relevant digest;
- exact campaign entity/participant IDs;
- tactical role;
- controller/behavior authority;
- team/faction;
- trainer/creature rules profiles as supported;
- materially relevant scene-present persistent entities;
- relevant scene-local objects/barriers;
- battlefield/exit zones;
- objectives and alternate terminal conditions;
- package/rules capability profile.

GameFrame validates against explicit tactical capabilities and fails closed if it cannot execute a combat-relevant requirement truthfully.

## 21. Tactical participation/outcomes

Target campaign roles may include:

- allied combatant;
- hostile combatant;
- neutral;
- civilian/noncombatant;
- protected entity;
- escaping entity;
- scripted/deterministic support entity;
- environmental/objective entity.

Target participant outcomes include:

- active;
- incapacitated;
- withdrew;
- fled;
- surrendered;
- recalled;
- dead only where an explicit lethal rules profile supports it.

Every individually instantiated persistent person/creature physically present when tactical mode begins must either be represented truthfully in supported form or have an explicit pre-launch scene transition out.

## 22. Embodied campaign return

A campaign-bound tactical result does not merely navigate back to an RPG route.

Correct return requires:

1. terminal GameFrame result commits;
2. runtime observes exact outcome;
3. world/scene/roster consequences reconcile exactly once;
4. GameFrame receives updated semantic scene projection;
5. accepted exploration materialization reflects committed consequences;
6. movement/interaction unlocks;
7. reconnect/restart preserves the same post-encounter state.

## 23. Repository authority

### RPG GM Runtime owns

- committed CampaignPackage truth;
- campaign journal/narrative revision;
- entity identity;
- Character Factory;
- semantic Scene Registry;
- semantic observer/player knowledge;
- Dungeon Master context modes/decisions;
- hidden NPC/world state;
- semantic world/location relationships;
- event/operation validation;
- scene-to-encounter compilation;
- reconciliation of GameFrame outcomes into campaign truth.

### GameFrame owns

- authenticated player identity/session;
- player-safe projections;
- accepted exploration materialization/geometry;
- movement/collision/picking/pathing;
- ephemeral avatar transforms/realtime projection;
- interaction UI;
- deterministic mechanics/tactical authority;
- materialized-scene/tactical persistence required for recovery;
- media/cinematic presentation.

No service reads the other's private database.

## 24. Acceptance

The scene/entity/knowledge substrate is established for the embodied product when:

- package/created entities retain stable IDs;
- one incidental entity can be created/admitted/revisited after restart;
- active semantic scenes reconstruct after restart;
- GameFrame can recover accepted materialization identity for an explored scene;
- two observers can hold different valid knowledge about one entity;
- an NPC performance context excludes a hidden fact the NPC does not know;
- player-known identity can progress descriptor→role→name without entity duplication;
- semantic scene transfer is durable while frame-by-frame movement is not journaled;
- a second connected exploration scene can be materialized/revisited;
- Arena handoff/return preserves source-scene identity and committed world consequences.

## Governing rule

> Runtime owns who/what/where/what-is-known in the semantic campaign world; GameFrame owns how that world is materialized and moved through; and neither model memory nor rendered pixels may silently become the authority for the other domain.
