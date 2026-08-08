---
title: RPG Scene, Entity, and Player Knowledge Contract
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
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-scene-entity-and-knowledge-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-scene-entity-and-knowledge-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Scene, Entity, and Player Knowledge Contract

## Decision

The RPG platform promotes **durable entities**, **authoritative scene membership**, and **viewer-specific character knowledge** into first-class runtime concepts.

The campaign journal remains authoritative history. The committed CampaignPackage remains immutable authored truth. Entity/scene/knowledge surfaces are deterministic projections and services over those authorities; they do not create a second campaign database or a third campaign agent.

The purpose is to prevent the Dungeon Master model from being used as implicit memory for questions the runtime can answer exactly:

- who exists;
- who is physically present and in which scene;
- what a person or creature is called by a particular viewer;
- what a player character has actually learned;
- what relevant objects, exits, and hazards remain in a scene;
- which entities and objectives must survive a scene-to-Arena handoff.

## Architecture

```text
committed CampaignPackage
        +
durable campaign journal
        ↓
Entity Registry + Scene Registry
        ↓
Runtime World Projection
        ↓
Knowledge Graph / Viewer Knowledge Projection
        ↓
Dungeon Master Context Compiler / GameFrame player views
```

When tactical authority is needed:

```text
authoritative source scene + scene revision/digest
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
Dungeon Master aftermath
```

## 1. Durable entity identity

Every person, trainer, monster, important creature, and campaign-relevant object that may persist across scenes receives a stable semantic entity identity.

A durable entity record may include:

- stable entity ID;
- entity kind;
- canonical runtime identity;
- public or player-safe descriptors;
- appearance identity or fallback;
- role and affiliations;
- competencies and rules profiles;
- relationships and durable conditions;
- private facts and visibility policy;
- presentation identity;
- provenance: package-authored, campaign-created, imported, or promoted incidental entity.

Stable identity does not imply that every viewer knows the entity's canonical name, role, secrets, or existence.

## 2. Character Factory

The Dungeon Master does not directly mint durable incidental character records by freeform prose.

When live play requires a plausible unprepared person, the Dungeon Master may submit a bounded semantic request such as:

```text
role: tavern-server
location: inn.red-hammer
constraints: local adult civilian
```

A runtime **Character Factory** materializes the durable incidental entity from validated rules and prepared role vocabularies.

The Character Factory is runtime substrate, not a third campaign agent. The default implementation should be deterministic/schema-first. A later provider may enrich allowed cosmetic or characterization fields, but validation and durable identity remain runtime-owned.

The Character Factory may create ordinary incidental people. It may not silently create or replace:

- a committed culprit;
- a decisive witness;
- a required clue owner;
- a secret authority;
- a package-invariant relationship;
- another package-bearing function that the CampaignPackage already fixed.

Campaign-bearing actors are authored in the CampaignPackage by manual authoring or the Campaign Architect unless the package explicitly declares an open role.

## 3. Incidental materialization transaction

When a new incidental person is first introduced into active play, durable creation must not be split into loosely related model/projection side effects.

The semantic transaction is conceptually:

```text
validated incidental-person request
→ materialize stable entity
→ admit entity to authoritative scene
→ establish only the initial viewer awareness justified by the encounter
→ commit one idempotent semantic result
→ Dungeon Master may portray the committed entity
```

A crash or exact retry must not create an entity that exists without intended scene admission, duplicate the person, or reveal more identity than the committed awareness state permits.

If a person is materialized for later/off-screen use rather than immediate presence, that distinction must be explicit in the request and no scene admission is implied.

## 4. Promotion of incidental entities

An incidental entity becomes durable/recurring when continuity matters, including when players:

- seek that person again;
- create a promise, debt, payment, injury, insult, favor, suspicion, employment, custody, rivalry, or relationship;
- assign them a task;
- cause them to witness or learn campaign-relevant facts;
- bring them into later travel or scenes.

Promotion preserves the same entity ID and presentation identity. It does not regenerate a replacement person.

Unique art is not required for promotion; GameFrame may retain a prepared portrait family, silhouette, or text card until a better asset deliberately supersedes it.

## 5. Authoritative Scene Registry

The runtime maintains **zero or more active scenes** rather than assuming the entire campaign always has one universal current scene. This permits later split-party or remote-play cases without changing the authority model.

A player-facing projection may still expose one current scene for the viewer's character.

A durable scene has at least:

```text
SceneStateV1
  sceneId
  locationId
  membership[]
  sceneLocalObjects[]
  hazards[]
  environmentalFeatures[]
  exits[]
  startedAt
  revision
  state
```

`membership[]` is the single authoritative physical-presence collection for persistent entities. Do not duplicate the same entity's presence across separate people/creature arrays.

Each membership record includes at least:

- entity ID;
- scene role;
- presence state;
- entry provenance;
- current disposition where relevant;
- tactical eligibility/role when applicable.

Entity kind comes from Entity Registry. Player projections may split the same membership into `presentPeople`, `presentCreatures`, and other convenient read models.

The registry owns enter, leave, transfer, remote-contact, and scene-end semantics.

A character may physically act in or speak as present in a scene only when scene membership admits that character, unless an explicit remote-communication relationship is active.

An absent known person may still be discussed, remembered, sought, messaged, or referenced. Scene membership limits physical presence, not ordinary thought or conversation about absent people.

## 6. Scene object and creature continuity

Persistent creatures/people use Entity Registry + scene membership. Scene-local geometry or low-value ephemeral material may remain scene-local when it does not need durable cross-scene identity.

The scene registry must preserve materially relevant facts needed for later deterministic resolution, including examples such as:

- a confiscation cart still contains particular cube cases;
- a road barrier remains closed or has been removed;
- a frightened pack animal remains attached to a cart;
- an intelligent monster escaped toward a named exit;
- a suspect left through a side road;
- a piece of evidence was damaged or removed.

The model may describe these facts, but description does not become authority until the corresponding semantic operation is validated and committed.

## 7. Knowledge records and viewer projections

World truth and viewer knowledge remain different domains.

The runtime should support a sparse semantic knowledge model keyed by observer/audience + subject + fact identity rather than storing player knowledge only as accumulated prose strings.

A knowledge record may include:

- observer/viewer or audience scope;
- subject entity/location/fact ID;
- semantic fact ID;
- knowledge state such as observed, suspected, learned, confirmed, corrected, or disproven where the domain needs it;
- provenance/source event;
- first learned / last revised positions;
- visibility scope;
- optional player-safe display material.

The platform does not need an eager all-entities-by-all-observers matrix. Create sparse knowledge edges only when campaign behavior needs them.

Player Knowledge Projection is the viewer-safe read model over those records and other authorized campaign state.

Knowledge may include:

- known people;
- known descriptors and names;
- known roles and affiliations;
- known relationships;
- known locations and routes;
- discovered clues and conclusions;
- known rules, license facts, monster facts, and campaign-specific information;
- remembered conversations or promises;
- player-private discoveries.

Unknown entity existence remains omitted rather than represented by redacted IDs, empty slots, hidden counts, or `null` placeholders.

## 8. Identity and name knowledge

A canonical runtime entity name is not automatically a player-known name.

For each viewer, an entity may be represented through a player-safe display identity such as:

```text
unknown descriptor → "the woman in inspector's gear"
learned role       → "the checkpoint inspector"
known name         → "Mara Venn"
```

The player-safe renderer and GameFrame People view must use the best identity label currently authorized for that viewer.

The hidden Dungeon Master decision stage may refer to `npc.mara-venn`; the renderer may receive only `the woman in inspector's gear` until a committed revelation makes the name known.

This is a structural authorization boundary, not a prompt-style preference.

## 9. Known People projection

GameFrame receives a narrow viewer-safe People projection rather than the runtime's complete entity registry or raw knowledge records.

A first display projection may support fields similar to:

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

`knownFacts[]` here is presentation material, not the authoritative knowledge store. It is derived from semantic knowledge records so facts can be revised/corrected without conflicting prose strings becoming state.

Only authorized knowledge appears. The presence of an entry itself must be authorized.

## 10. Dungeon Master Context Compiler

The production Dungeon Master should consume typed current-state context rather than use a bounded raw-journal dump as its primary memory mechanism.

The hidden context compiler should assemble only the state relevant to the current trigger, including:

```text
immutable campaign invariants
relevant authoritative scene(s)
present/relevant entity records required for hidden reasoning
current objectives / pressure / eligible events
operational rosters and unresolved mechanics
knowledge relevant to the acting player/party and relevant NPC observers
bounded recent narrative context
current GmTurnTrigger
```

The journal remains the source of truth and audit trail. Typed projections are reconstructible read layers.

The compiler must distinguish hidden-decision context from later player-safe rendering context.

## 11. Hidden decision and player-safe rendering

The Dungeon Master path remains two-stage:

```text
hidden authorized runtime context
→ semantic decision with no player-facing prose
→ deterministic validation/materialization
→ committed consequences and authorized revelations
→ viewer-safe scene/world/knowledge projection
→ player-facing renderer
```

The renderer must never receive unrevealed canonical names, unknown entity IDs, hidden motives, hidden scene facts, event eligibility, clue meanings, or runtime-only relationships merely because the hidden decision model needed them.

## 12. Player action versus player-to-GM query

GameFrame must distinguish an in-fiction declaration from a player asking the Dungeon Master for information or rules clarification.

At minimum the platform supports two intents:

- **Act / Speak** — an in-character or fictional-world action that may advance the scene and may be perceived by present entities;
- **Ask Game Master** — a player-to-GM query answered from viewer-authorized character knowledge and mechanics without automatically becoming fictional speech or advancing time.

The transport contract represents these as distinct command/trigger semantics rather than relying on the model to guess from prose.

A player-to-GM query must not make NPCs hear the question unless the player separately takes an in-fiction action.

**Default audience posture:** Ask-GM request/response is player-private unless a future command explicitly requests a broader table/party-visible audience. Fictional audibility and presentation audience are separate fields.

## 13. Presentation origin

GameFrame presentation events identify semantic origin separately from audience.

Useful origins include:

- player;
- Dungeon Master;
- NPC/entity;
- system;
- tactical encounter.

The UI may then render clear labels such as `PLAYER — Orange`, `GAME MASTER`, or a viewer-safe NPC label instead of generic bookkeeping headings such as `Action Submitted`.

## 14. Scene-to-Arena projection

A tactical encounter is a stricter resolution mode for the current fictional scene, not an unrelated duel that happens to share creature IDs.

The runtime **Encounter Scene Compiler** projects the subset of source-scene truth that GameFrame must execute authoritatively.

A first encounter-scene contract should carry:

- source scene ID;
- source scene revision or equivalent authoritative position;
- deterministic source-scene digest over combat-relevant semantic state;
- exact campaign entity/participant IDs;
- tactical role;
- controller or behavior authority;
- team/faction;
- trainer/creature rules profiles as supported;
- scene-present persistent entities that materially affect legal actions/objectives;
- scene-local objects/barriers required by the objective;
- battlefield/exit zones derived from the current scene;
- objectives and alternate terminal conditions;
- package/rules capability profile.

GameFrame validates the projection against an explicit tactical capability set and fails closed if it cannot execute a combat-relevant requirement truthfully.

If source scene state changes materially between compilation and encounter custody, the request must be revalidated/recompiled rather than silently launching stale tactical truth.

## 15. Tactical participation and representation

Campaign encounters require more than `human side` and `opposition side`.

The tactical contract should support bounded roles such as:

- allied combatant;
- hostile combatant;
- neutral;
- civilian/noncombatant;
- protected entity;
- escaping entity;
- scripted or deterministic support entity;
- environmental/objective entity.

Every individually instantiated persistent person/creature physically present when tactical mode begins must either:

1. be represented in the tactical encounter in a truthful supported form; or
2. have an explicit pre-launch scene transition proving that they left/withdrew/were moved out of the encounter.

Not every present entity must be a fully controllable combat unit. A present civilian may be represented as a protected/noncombatant entity, a support participant, or another explicit supported abstraction. Large anonymous crowds may be represented by an aggregate crowd entity when individual identity is not materially relevant.

Unsupported required roles must fail closed rather than disappear.

## 16. Withdrawal, escape, surrender, recall, and death semantics

Campaign tactical outcomes require explicit terminal participant states rather than treating defeat as the only meaningful exit.

The target vocabulary includes at least:

- active;
- incapacitated;
- withdrew;
- fled;
- surrendered;
- recalled.

If the selected campaign/ruleset supports lethal outcomes, `dead` is a separate explicit state and must not be inferred merely from reaching zero tactical health unless the rules say so.

Escape should be represented by legal movement/objective mechanics such as visible exit zones or other explicit withdrawal conditions. A creature trying to flee should not be forced to remain in combat because the only terminal rule is elimination.

## 17. Campaign-bound tactical terminal UX

A campaign battle is not a standalone replay loop.

When an Arena match is campaign-bound and reaches terminal state, GameFrame should present campaign-specific terminal UX:

- primary action: **Return to Campaign**;
- no ordinary `New Duel` action that creates an unrelated follow-up match;
- no primary `Return Home` path that abandons the campaign lifecycle;
- terminal copy should describe the committed encounter result and campaign return state, not a generic duel completion.

Navigation back to the campaign page is not itself proof that the runtime consumed the outcome. Narrative input remains fenced until authoritative aftermath/reconciliation produces a later resumable campaign state.

## 18. Monster Master RPG relationship to MM-0001

The fixed standalone Monster Master duel remains a useful small game and regression target.

Do not silently broaden MM-0001 until it becomes the entire RPG encounter engine.

Monster Master RPG defines a separate campaign-configured encounter contract that reuses GameFrame tactical primitives and `MatchSession` authority while adding only the scene-fidelity capabilities proven necessary by campaigns.

## 19. Handcrafted and generated campaigns

Both handcrafted and Campaign-Architect-generated packages use the same entity, scene, knowledge, context, and encounter contracts.

Authoring mode affects provenance only.

An owner may iteratively refine a generated or handcrafted package before commitment:

```text
brief / source material
→ draft CampaignPackage
→ optional owner editing
→ validation and repair
→ player-safe preview
→ commitment
```

An active committed package is not silently rewritten. Later campaign-foundation changes require an explicit version/amendment/migration lifecycle.

## 20. Repository authority

### RPG GM Runtime owns

- entity registry and stable campaign entity identities;
- Character Factory validation/materialization;
- authoritative scene projection over campaign truth;
- semantic knowledge records and player/party knowledge derivation;
- Dungeon Master context compilation;
- hidden decision validation and revelations;
- scene-to-encounter semantic projection;
- reconciliation of GameFrame outcomes into campaign world/scene truth.

### GameFrame owns

- authenticated player principals and UI;
- People/character/location/scene projections presented to authorized viewers;
- Act/Speak and Ask-GM interaction surfaces;
- deterministic mechanics explicitly implemented in GameFrame;
- tactical encounter validation/materialization;
- legal tactical actions, replay, persistence, and terminal outcome authority;
- campaign-bound tactical terminal UX;
- semantic media resolution and rendering.

Neither repository reads the other's private database.

## 21. Evidence requirements

The implementation must separately prove:

1. incidental entity creation produces one stable ID and exact retry does not duplicate it;
2. immediate incidental materialization + scene admission + initial viewer awareness is atomic/idempotent;
3. promoted incidental NPCs return with the same identity and continuity;
4. a character cannot physically act from an absent scene without an explicit remote channel;
5. hidden canonical names stay out of renderer input until authorized;
6. two different players may receive different valid identity/knowledge projections for the same runtime entity;
7. corrected/superseded knowledge does not remain authoritative merely as contradictory prose strings;
8. People projections omit unknown entity existence;
9. player-to-GM queries do not become in-fiction speech and default to player-private presentation;
10. typed active-scene state survives runtime restart;
11. scene-to-Arena projection preserves exact source scene identity/revision, participant identities, and required roles;
12. stale source-scene encounter requests fail/recompile before custody;
13. unsupported tactical roles/configuration fail before encounter custody;
14. withdrawal/escape outcomes return as structured campaign consequences when supported;
15. tactical aftermath reconciles back into the same scene/world entities without duplication or retcon;
16. campaign-bound terminal UI does not offer unrelated standalone-duel continuation and narrative input unlocks only after authoritative aftermath.

## Governing rule

> The model may interpret and portray the world, but durable entities, physical scene presence, semantic knowledge, and tactical participant identity are explicit runtime state. The RPG should never depend on the Dungeon Master model to remember who exists, who is here, what a viewer knows, or which people disappear when the minis come out.
