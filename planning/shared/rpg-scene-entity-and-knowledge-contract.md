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
shared_document_version: 1
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

The RPG platform promotes **durable entities**, **authoritative scene membership**, and **player-character knowledge** into first-class runtime concepts.

The campaign journal remains authoritative history. The committed CampaignPackage remains immutable authored truth. The new scene/entity/knowledge surfaces are deterministic projections and services over those authorities; they do not create a second campaign database or a third campaign agent.

The purpose is to prevent the Dungeon Master model from being used as implicit memory for questions the runtime can answer exactly:

- who exists;
- who is physically present;
- what a person is called by this player;
- what a player character has actually learned;
- what objects, creatures, exits, and hazards are in the current scene;
- which participants and objectives must survive a scene-to-Arena handoff.

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
Player Knowledge Projection
        ↓
Dungeon Master Context Compiler / GameFrame player views
```

When tactical authority is needed:

```text
current authoritative scene
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

## 3. Promotion of incidental entities

An incidental entity becomes durable/recurring when continuity matters, including when players:

- seek that person again;
- create a promise, debt, payment, injury, insult, favor, suspicion, employment, custody, rivalry, or relationship;
- assign them a task;
- cause them to witness or learn campaign-relevant facts;
- bring them into later travel or scenes.

Promotion preserves the same entity ID and presentation identity. It does not regenerate a replacement person.

Unique art is not required for promotion; GameFrame may retain a prepared portrait family, silhouette, or text card until a better asset deliberately supersedes it.

## 4. Authoritative Scene Registry

The runtime maintains an explicit current-scene projection rather than asking the model to infer presence from recent prose.

A scene has at least:

```text
SceneStateV1
  sceneId
  locationId
  participants[]
  creatures[]
  objects[]
  hazards[]
  environmentalFeatures[]
  exits[]
  startedAt
  state
```

Scene participant membership records at least:

- entity ID;
- scene role;
- presence state;
- entry provenance;
- current disposition where relevant;
- audience/visibility constraints;
- tactical eligibility when applicable.

The registry owns enter, leave, transfer, remote-contact, and scene-end semantics.

A character may physically act in or speak as present in a scene only when current scene state admits that character, unless an explicit remote-communication relationship is active.

An absent known person may still be discussed, remembered, sought, messaged, or referenced. Scene membership limits physical presence, not ordinary thought or conversation about absent people.

## 5. Scene object and creature continuity

Objects, monsters, civilians, vehicles, hazards, barriers, containers, doors, exits, and other scene-relevant elements may be represented as stable or scene-local entities as appropriate.

The scene registry must preserve materially relevant facts needed for later deterministic resolution, including examples such as:

- a confiscation cart still contains particular cube cases;
- a road barrier remains closed or has been removed;
- a frightened pack animal remains attached to a cart;
- an intelligent monster escaped toward a named exit;
- a suspect left through a side road;
- a piece of evidence was damaged or removed.

The model may describe these facts, but description does not become authority until the corresponding semantic operation is validated and committed.

## 6. Player-character knowledge

World truth and player knowledge remain different domains.

The runtime derives a viewer-specific knowledge projection that answers what a particular player character is entitled to know now.

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

## 7. Identity and name knowledge

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

## 8. Known People projection

GameFrame should receive a narrow viewer-safe People projection rather than the runtime's complete entity registry.

A first version should support fields similar to:

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

Only authorized knowledge appears. The presence of an entry itself must be authorized.

This projection supports a People/Characters surface where the player can review whom their character has met and what they actually know without exposing runtime secrets.

## 9. Dungeon Master Context Compiler

The production Dungeon Master should consume a typed current-state context rather than use a bounded raw-journal dump as its primary memory mechanism.

The context compiler should assemble only the state relevant to the current trigger, including:

```text
immutable campaign invariants
current authoritative scene
present entity records required for hidden reasoning
current objectives / pressure / eligible events
operational rosters and unresolved mechanics
player/party knowledge relevant to the turn
bounded recent narrative context
current GmTurnTrigger
```

The journal remains the source of truth and audit trail. Typed projections are reconstructible read layers.

The compiler must distinguish the hidden-decision context from the later player-safe rendering context.

## 10. Hidden decision and player-safe rendering

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

## 11. Player action versus player-to-GM query

GameFrame must distinguish an in-fiction declaration from a player asking the Dungeon Master for information or rules clarification.

At minimum the platform supports two intents:

- **Act / Speak** — an in-character or fictional-world action that may advance the scene and may be perceived by present entities;
- **Ask Game Master** — a player-to-GM query answered from player-authorized knowledge and mechanics without automatically becoming fictional speech or advancing time.

The transport contract should represent these as distinct command/trigger semantics rather than rely on the model to guess from prose.

A player-to-GM query must not make NPCs hear the question unless the player separately takes an in-fiction action.

## 12. Presentation origin

GameFrame presentation events should identify their semantic origin separately from audience.

Useful origins include:

- player;
- Dungeon Master;
- NPC/entity;
- system;
- tactical encounter.

The UI may then render clear labels such as `PLAYER — Orange`, `GAME MASTER`, or a viewer-safe NPC label instead of generic bookkeeping headings such as `Action Submitted`.

## 13. Scene-to-Arena projection

A tactical encounter is a stricter resolution mode for the current fictional scene, not an unrelated duel that happens to share creature IDs.

The runtime **Encounter Scene Compiler** projects the subset of current scene truth that GameFrame must execute authoritatively.

A first encounter-scene contract should represent:

- exact campaign entity/participant IDs;
- tactical role;
- controller or behavior authority;
- team/faction;
- deployed or scene-present creatures;
- trainer participation when supported;
- civilians or noncombatants when relevant;
- neutral/escaping entities;
- encounter objects and barriers required by the objective;
- battlefield/exit zones derived from the current scene;
- objectives and alternate terminal conditions;
- package/rules capability profile.

GameFrame validates the projection against an explicit tactical capability set and fails closed if it cannot execute a combat-relevant requirement truthfully.

## 14. Tactical participation roles

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

The first implementation may support only a subset, but unsupported roles must fail closed rather than disappear.

## 15. Withdrawal, escape, surrender, recall, and death semantics

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

## 16. Monster Master RPG relationship to MM-0001

The fixed standalone Monster Master duel remains a useful small game and regression target.

Do not silently broaden MM-0001 until it becomes the entire RPG encounter engine.

Monster Master RPG should define a separate campaign-configured encounter contract that reuses GameFrame tactical primitives and `MatchSession` authority while adding only the scene-fidelity capabilities proven necessary by campaigns.

## 17. Handcrafted and generated campaigns

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

## 18. Repository authority

### RPG GM Runtime owns

- entity registry and stable campaign entity identities;
- Character Factory validation/materialization;
- authoritative scene projection over campaign truth;
- player/party knowledge derivation;
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
- semantic media resolution and rendering.

Neither repository reads the other's private database.

## 19. Evidence requirements

The implementation must separately prove:

1. incidental entity creation produces one stable ID and exact retry does not duplicate it;
2. promoted incidental NPCs return with the same identity and continuity;
3. a character cannot physically act from an absent scene without an explicit remote channel;
4. hidden canonical names stay out of renderer input until authorized;
5. two different players may receive different valid identity/knowledge projections for the same runtime entity;
6. People projections omit unknown entity existence;
7. player-to-GM queries do not become in-fiction speech;
8. typed current-scene context survives runtime restart;
9. scene-to-Arena projection preserves exact participant identities and required scene roles;
10. unsupported tactical roles/configuration fail before encounter custody;
11. withdrawal/escape outcomes return as structured campaign consequences when supported;
12. tactical aftermath reconciles back into the same scene/world entities without duplication or retcon.

## Governing rule

> The model may interpret and portray the world, but durable entities, physical scene presence, player knowledge, and tactical participant identity are explicit runtime state. The RPG should never depend on the Dungeon Master model to remember who exists, who is here, what the player knows, or which people disappear when the minis come out.
